import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getVideoToken, getVideoPreviewUrl } from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import { isVideoScheduled } from "@/lib/video-status"

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * GET - Obtiene la URL del preview video MP4 con token firmado
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await releaseDueVideos()
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const quality = (searchParams.get("quality") as "low" | "medium" | "high") || "medium"

    const video = await prisma.video.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        releaseDate: true,
        muxPlaybackId: true,
        previewStartTime: true,
        previewEndTime: true,
      },
    })

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
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

    if (!video.muxPlaybackId) {
      return NextResponse.json(
        { error: "The video has not been processed in Mux yet" },
        { status: 400 }
      )
    }

    // Generar token firmado para el video MP4
    const token = await getVideoToken(video.muxPlaybackId)

    // Generar URL del MP4 con token
    const previewUrl = getVideoPreviewUrl(video.muxPlaybackId, token, quality)

    return NextResponse.json({
      previewUrl,
      playbackId: video.muxPlaybackId,
      format: "mp4",
      quality,
      options: {
        start: video.previewStartTime,
        end: video.previewEndTime,
        duration: video.previewEndTime - video.previewStartTime,
      },
    })
  } catch (error) {
    console.error("Error generating preview URL:", error)
    return NextResponse.json(
      { error: "Error generating preview URL" },
      { status: 500 }
    )
  }
}
