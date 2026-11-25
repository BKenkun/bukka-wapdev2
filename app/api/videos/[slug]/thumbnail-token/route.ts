import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getThumbnailToken, isMuxSigningConfigured } from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import { isVideoScheduled } from "@/lib/video-status"

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await releaseDueVideos()
    const { slug } = await params

    const video = await prisma.video.findUnique({
      where: { slug },
      select: {
        status: true,
        releaseDate: true,
        muxPlaybackId: true,
      },
    })

    if (!video || video.status === "DRAFT" || video.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      )
    }

    if (isVideoScheduled(video)) {
      return NextResponse.json(
        { error: "Video is scheduled and not available yet" },
        { status: 403 }
      )
    }

    if (!video.muxPlaybackId) {
      return NextResponse.json(
        { error: "Video not found or missing playback ID" },
        { status: 404 }
      )
    }

    if (!isMuxSigningConfigured()) {
      return NextResponse.json({ token: null, configured: false })
    }

    const token = await getThumbnailToken(video.muxPlaybackId)

    return NextResponse.json({ token, configured: true })
  } catch (error) {
    console.error("Error getting thumbnail token:", error)
    return NextResponse.json(
      { error: "Error fetching thumbnail token" },
      { status: 500 }
    )
  }
}
