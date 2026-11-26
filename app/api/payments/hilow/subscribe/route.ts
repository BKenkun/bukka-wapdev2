import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { validateReferralCode } from "@/lib/referral-codes"
import {
  HilowGatewayError,
  createHilowOrder,
  getHilowConfig,
  isHilowConfigured,
} from "@/lib/hilow"

export async function POST(request: NextRequest) {
  try {
    if (!isHilowConfigured()) {
      return NextResponse.json(
        { error: "Hilow Global payment gateway is not configured" },
        { status: 503 }
      )
    }

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const planId = typeof body?.planId === "string" ? body.planId.trim() : ""
    const referralCode =
      typeof body?.referralCode === "string" ? body.referralCode.trim() : ""

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 })
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { error: "This plan is not available" },
        { status: 400 }
      )
    }

    if (plan.isFree) {
      return NextResponse.json(
        { error: "Cannot pay for a free plan" },
        { status: 400 }
      )
    }

    const monthlyPrice = Number(plan.monthlyPrice)
    if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
      return NextResponse.json({ error: "Invalid plan price" }, { status: 400 })
    }

    // Validate referral code on server and apply discount to first cycle only
    let referralCodeId: string | null = null
    let referralDiscountPercent = 0
    let firstChargeEur = monthlyPrice

    if (referralCode) {
      const refResult = await validateReferralCode(
        referralCode,
        "subscription",
        monthlyPrice
      )
      if (refResult.ok && refResult.referral) {
        referralCodeId = refResult.referral.id
        referralDiscountPercent = refResult.referral.discountPercent
        if (referralDiscountPercent > 0) {
          firstChargeEur = Math.max(
            0,
            Math.round(monthlyPrice * (1 - referralDiscountPercent / 100) * 100) / 100
          )
        }
      }
    }

    const amountInCents = Math.round(firstChargeEur * 100)
    const rebillAmountInCents = Math.round(monthlyPrice * 100)
    if (amountInCents <= 0 || rebillAmountInCents <= 0) {
      return NextResponse.json(
        { error: "Invalid subscription amount" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const config = getHilowConfig()
    const safeSlug = plan.slug.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 32) || "plan"
    const internalOrderId = `SUB_${user.id}_${safeSlug}_${Date.now()}`

    const result = await createHilowOrder({
      internalOrderId,
      amountInCents,
      rebillAmountInCents,
      interval: "month",
      currency: config.currency,
      productName: `${plan.name} Subscription - Monthly`,
      isSubscription: true,
      customerEmail: user.email,
      customerName: user.name || user.email,
      customerId: user.id,
      metadata: {
        type: "subscription",
        planId: plan.id,
        planSlug: plan.slug,
        userId: user.id,
        ...(referralCodeId ? { referralCodeId } : {}),
        ...(referralDiscountPercent > 0 ? { referralDiscountPercent } : {}),
      },
      successUrl: `${config.baseUrl}/suscripcion/resultado?plan=${encodeURIComponent(plan.slug)}&status=success`,
      cancelUrl: `${config.baseUrl}/suscripcion/resultado?plan=${encodeURIComponent(plan.slug)}&status=failed`,
      webhookUrl: `${config.baseUrl}/api/webhooks/hilow`,
    })

    return NextResponse.json({
      payLink: result.payLink,
      gateway: "hilow",
      hilowOrderId: result.hilowOrderId,
      subscriptionId: result.subscriptionId,
    })
  } catch (error) {
    if (error instanceof HilowGatewayError) {
      console.warn(`[Hilow] Subscription initiation rejected (${error.statusCode}): ${error.gatewayMessage}`)
      if (/disabled for this merchant/i.test(error.gatewayMessage)) {
        return NextResponse.json(
          {
            error: "Subscription payment gateway service is temporarily unavailable.",
            code: "HILOW_MERCHANT_DISABLED",
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        {
          error: error.gatewayMessage || "Failed to initiate Hilow subscription",
          code: "HILOW_GATEWAY_ERROR",
        },
        { status: error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502 }
      )
    }

    console.error("[Hilow] Error initiating subscription:", error)
    return NextResponse.json(
      { error: "Failed to initiate Hilow subscription" },
      { status: 502 }
    )
  }
}
