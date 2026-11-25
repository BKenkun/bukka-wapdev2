import { NextRequest, NextResponse } from "next/server"
import { releaseDueVideos } from "@/lib/video-release"

/**
 * Cron endpoint for scheduled video releases.
 * Publishes any SCHEDULED video whose releaseDate <= now and sends idempotent
 * notification emails to queued VideoNotify subscribers.
 */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET
  const secret = request.headers.get("x-cron-secret")
  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await releaseDueVideos({
    force: true,
    awaitNotifications: true,
  })

  return NextResponse.json({
    ok: true,
    ...summary,
    now: new Date().toISOString(),
  })
}
