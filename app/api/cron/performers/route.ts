import { NextRequest, NextResponse } from "next/server"
import { releaseDuePerformers } from "@/lib/performer-release"

/**
 * Cron endpoint for scheduled performer releases.
 * Unlocks any performer with comingSoon=true and comingSoonDate <= now,
 * sets releasedAt=now, and sends idempotent notification emails to queued subscribers.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret")
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const summary = await releaseDuePerformers({
    force: true,
    awaitNotifications: true,
  })

  return NextResponse.json({
    ok: true,
    ...summary,
    now: new Date().toISOString(),
  })
}
