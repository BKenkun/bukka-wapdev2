import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  isMuxSigningConfigured,
  resolveMuxPreviewMedia,
} from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import { isVideoScheduled } from "@/lib/video-status"

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * GET - Obtiene la URL del preview (R2 custom, MP4 estático real de Mux o animated.webp firmado)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await releaseDueVideos()
    const { slug } = await params

    const video = await prisma.video.findUnique({
      where: { slug },
      select: {
        id: true,
        status: true,
        releaseDate: true,
        previewUrl: true,
        muxAssetId: true,
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

    // 1. Prioridad: preview custom (p. ej. MP4 subido a R2)
    if (video.previewUrl) {
      return NextResponse.json({
        previewUrl: video.previewUrl,
        playbackId: video.muxPlaybackId,
        format: "mp4",
        quality: "custom",
        options: {
          start: video.previewStartTime,
          end: video.previewEndTime,
          duration: Math.max(0, video.previewEndTime - video.previewStartTime),
        },
      })
    }

    if (!video.muxPlaybackId) {
      return NextResponse.json(
        { error: "The video has not been processed in Mux yet" },
        { status: 400 }
      )
    }

    if (!isMuxSigningConfigured()) {
      return NextResponse.json({
        previewUrl: null,
        playbackId: video.muxPlaybackId,
        configured: false,
      })
    }

    // 2. Resolver rendition MP4 real disponible en Mux (o fallback animated.webp firmado)
    const resolved = await resolveMuxPreviewMedia(
      video.muxAssetId,
      video.muxPlaybackId,
      {
        start: video.previewStartTime,
        end: video.previewEndTime,
      }
    )

    return NextResponse.json({
      previewUrl: resolved.previewUrl,
      playbackId: video.muxPlaybackId,
      format: resolved.format,
      quality: resolved.quality,
      options: {
        start: video.previewStartTime,
        end: video.previewEndTime,
        duration: Math.max(0, video.previewEndTime - video.previewStartTime),
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
