import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

async function resolveVideoId(slugOrId: string): Promise<string | null> {
  const trimmed = slugOrId.trim()
  if (!trimmed || trimmed.length > 128) return null

  const video = await prisma.video.findFirst({
    where: {
      OR: [{ id: trimmed }, { slug: trimmed }],
      status: { in: ["SCHEDULED", "PUBLISHED"] },
    },
    select: { id: true },
  })
  return video?.id || null
}

// GET - Check if authenticated user is subscribed to release notifications for this video
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ subscribed: false })
    }

    const { slug } = await params
    const videoId = await resolveVideoId(slug)
    if (!videoId) {
      return NextResponse.json({ subscribed: false })
    }

    const notify = await prisma.videoNotify.findUnique({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId,
        },
      },
    })

    return NextResponse.json({
      subscribed: !!notify,
      notified: notify?.notified || false,
    })
  } catch {
    return NextResponse.json({ subscribed: false })
  }
}

// POST - Toggle Notify Me subscription for this video (requires authentication)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Login required" }, { status: 401 })
    }

    const { slug } = await params
    const videoId = await resolveVideoId(slug)

    if (!videoId) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const existing = await prisma.videoNotify.findUnique({
      where: {
        userId_videoId: {
          userId: session.user.id,
          videoId,
        },
      },
    })

    if (existing) {
      await prisma.videoNotify.delete({ where: { id: existing.id } })
      return NextResponse.json({ subscribed: false })
    }

    await prisma.videoNotify.create({
      data: {
        userId: session.user.id,
        videoId,
      },
    })

    return NextResponse.json({ subscribed: true })
  } catch (error) {
    const err = error as { code?: string; message?: string }
    if (
      err?.code === "P2021" ||
      (typeof err?.message === "string" && err.message.includes("VideoNotify"))
    ) {
      return NextResponse.json(
        { error: "Notification table pending database migration" },
        { status: 503 }
      )
    }
    console.error("Video notify toggle error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
