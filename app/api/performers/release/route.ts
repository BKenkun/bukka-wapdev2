import { NextResponse } from "next/server"
import { releaseDuePerformers } from "@/lib/performer-release"

/**
 * Triggered when a client countdown finishes so due performers unlock in DB
 * and dispatch subscriber notifications without waiting for the next cron tick.
 */
export async function POST() {
  try {
    const summary = await releaseDuePerformers({
      force: true,
      awaitNotifications: false,
    })
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    console.error("Error triggering performer release:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
