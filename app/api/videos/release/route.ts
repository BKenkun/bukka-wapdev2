import { NextResponse } from "next/server"
import { releaseDueVideos } from "@/lib/video-release"

/**
 * Triggered when a client countdown hits zero so due scheduled videos publish
 * and dispatch subscriber notifications immediately without waiting for cron.
 */
export async function POST() {
  try {
    const summary = await releaseDueVideos({
      force: true,
      awaitNotifications: false,
    })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error("Error triggering video release:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
