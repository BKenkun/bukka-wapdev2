import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkVideoAccess } from "@/lib/subscription-guard"
import { getVideoToken, getMuxAsset } from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import { isVideoScheduled } from "@/lib/video-status"
import {
  getVideoDownloadOverride,
  getVideoDownloadPolicy,
} from "@/lib/get-video-download-policy"
import {
  evaluateVideoDownloadAvailability,
  formatDownloadUnlockDate,
} from "@/lib/video-download-policy"

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params

    // Verificar autenticación
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must log in to download" },
        { status: 401 }
      )
    }

    // Obtener usuario con plan de suscripción
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        SubscriptionPlan: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Verificar que el plan permita descargas
    if (!user.SubscriptionPlan?.canDownload) {
      return NextResponse.json(
        {
          error: "Your plan does not allow downloads",
          requiredFeature: "canDownload",
        },
        { status: 403 }
      )
    }

    await releaseDueVideos()

    // Obtener el video
    const video = await prisma.video.findUnique({
      where: { slug },
      include: {
        minTierPlan: {
          select: { id: true, slug: true, name: true, level: true },
        },
      },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const nowMs = Date.now()
    let effectiveStatus = video.status
    if (effectiveStatus === "SCHEDULED" && video.releaseDate && video.releaseDate.getTime() <= nowMs) {
      await releaseDueVideos({ force: true })
      const refreshed = await prisma.video.findUnique({
        where: { id: video.id },
        select: { status: true },
      })
      if (refreshed) effectiveStatus = refreshed.status
    }

    if (effectiveStatus === "DRAFT" || effectiveStatus === "ARCHIVED") {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    if (isVideoScheduled({ status: effectiveStatus, releaseDate: video.releaseDate }, nowMs)) {
      return NextResponse.json(
        {
          error: "This video is scheduled and not available yet",
          reason: "SCHEDULED",
          availableAt: video.releaseDate,
        },
        { status: 403 }
      )
    }

    if (!video.muxPlaybackId || !video.muxAssetId) {
      return NextResponse.json(
        { error: "Video not available for download" },
        { status: 404 }
      )
    }

    // Verificar acceso al video
    const accessResult = await checkVideoAccess(
      {
        id: user.id,
        subscriptionPlanId: user.subscriptionPlanId,
        subscriptionPlan: user.SubscriptionPlan,
        subscriptionEnd: user.subscriptionEnd,
      },
      {
        minTierPlanId: video.minTierPlanId,
        minTierPlan: video.minTierPlan,
        isDiamondExclusive: video.isDiamondExclusive,
        isLimitedEdition: video.isLimitedEdition,
        limitedAccessUntil: video.limitedAccessUntil,
      }
    )

    if (!accessResult.hasAccess) {
      return NextResponse.json(
        {
          error: "You do not have access to this video",
          reason: accessResult.reason,
          requiredPlanName: accessResult.requiredPlanName,
        },
        { status: 403 }
      )
    }

    // Enforce global download waiting period (default: 3 months) and per-video download schedule
    const [downloadPolicy, downloadOverride] = await Promise.all([
      getVideoDownloadPolicy(),
      getVideoDownloadOverride(video.id),
    ])

    const downloadAvailability = evaluateVideoDownloadAvailability({
      releaseDate: video.releaseDate,
      publishedAt: video.publishedAt,
      createdAt: video.createdAt,
      policy: downloadPolicy,
      override: downloadOverride,
      now: nowMs,
    })

    if (!downloadAvailability.isAvailable) {
      const unlockLabel = downloadAvailability.availableAt
        ? formatDownloadUnlockDate(downloadAvailability.availableAt, "en")
        : null

      const message =
        downloadAvailability.reason === "DISABLED"
          ? "Downloads are disabled for this video"
          : unlockLabel
            ? `Downloads for this video will be available on ${unlockLabel}`
            : "Downloads are not available for this video yet"

      return NextResponse.json(
        {
          error: message,
          reason: downloadAvailability.reason,
          downloadAvailableAt: downloadAvailability.availableAt?.toISOString() ?? null,
          daysRemaining: downloadAvailability.daysRemaining,
        },
        { status: 403 }
      )
    }

    // Consultar el asset de Mux para obtener las rendiciones MP4 reales disponibles
    const asset = await getMuxAsset(video.muxAssetId)
    const staticFiles = asset.static_renditions?.files ?? []
    const mp4Files = staticFiles.filter((f) => f.name?.endsWith(".mp4") && f.status === "ready")

    if (mp4Files.length === 0) {
      return NextResponse.json(
        {
          error:
            "The video does not have MP4 renditions ready for download yet. Try again in a few minutes.",
        },
        { status: 503 }
      )
    }

    // Orden de preferencia: mejor calidad primero
    const preferenceOrder = [
      "capped-1080p.mp4",
      "high.mp4",
      "medium.mp4",
      "low.mp4",
      "audio.m4a",
    ]
    const maxVideoQuality = user.SubscriptionPlan?.maxVideoQuality || "720p"
    const allowHighQuality = ["1080p", "1440p", "2160p", "4k"].includes(
      maxVideoQuality.toLowerCase()
    )

    // Si el plan no permite alta calidad, filtrar capped-1080p y high
    const availableByPreference = preferenceOrder
      .map((name) => mp4Files.find((f) => f.name === name))
      .filter((f): f is NonNullable<typeof f> => Boolean(f))

    const chosenFile = allowHighQuality
      ? availableByPreference[0]
      : availableByPreference.find((f) => f.name !== "capped-1080p.mp4" && f.name !== "high.mp4") ??
        availableByPreference[availableByPreference.length - 1]

    if (!chosenFile || !chosenFile.name) {
      return NextResponse.json(
        { error: "No compatible MP4 rendition found" },
        { status: 503 }
      )
    }

    // Generar token firmado para la descarga
    const token = await getVideoToken(video.muxPlaybackId)

    // Construir URL de descarga
    const downloadUrl = `https://stream.mux.com/${video.muxPlaybackId}/${chosenFile.name}?token=${token}&download=${encodeURIComponent(video.title)}`

    return NextResponse.json({
      downloadUrl,
      quality: chosenFile.name,
      maxQuality: maxVideoQuality,
      filename: `${video.title}.mp4`,
    })
  } catch (error) {
    console.error("Error generating download URL:", error)
    return NextResponse.json(
      { error: "Error generating download link" },
      { status: 500 }
    )
  }
}
