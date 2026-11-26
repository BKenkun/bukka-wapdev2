import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  HilowGatewayError,
  cancelHilowSubscription,
  getUserHilowSubscription,
  isHilowConfigured,
  saveUserHilowSubscription,
} from "@/lib/hilow"

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isHilowConfigured()) {
      return NextResponse.json(
        { error: "Payment gateway is temporarily unavailable" },
        { status: 503 }
      )
    }

    const hilowSub = await getUserHilowSubscription(session.user.id)
    if (!hilowSub?.subscriptionId) {
      return NextResponse.json(
        { error: "No active Hilow subscription found for this account" },
        { status: 404 }
      )
    }

    if (hilowSub.cancelAtPeriodEnd) {
      return NextResponse.json({
        success: true,
        alreadyScheduled: true,
        currentPeriodEnd: hilowSub.currentPeriodEnd,
      })
    }

    // Schedule cancellation at end of current billing period (keeps access until period end)
    await cancelHilowSubscription(hilowSub.subscriptionId, false)

    await saveUserHilowSubscription(session.user.id, {
      ...hilowSub,
      cancelAtPeriodEnd: true,
    })

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      currentPeriodEnd: hilowSub.currentPeriodEnd,
    })
  } catch (error) {
    if (error instanceof HilowGatewayError) {
      console.warn(`[Hilow] Subscription cancel rejected (${error.statusCode}): ${error.gatewayMessage}`)
      return NextResponse.json(
        { error: error.gatewayMessage || "Could not cancel subscription. Please try again." },
        { status: error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502 }
      )
    }

    console.error("[Hilow] Error cancelling subscription:", error)
    return NextResponse.json(
      { error: "Could not cancel subscription. Please try again." },
      { status: 502 }
    )
  }
}
