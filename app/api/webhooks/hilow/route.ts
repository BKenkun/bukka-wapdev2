import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  findUserIdByHilowSubscriptionId,
  isHilowConfigured,
  isHilowWebhookConfigured,
  verifyHilowWebhookSignature,
} from "@/lib/hilow"
import {
  fulfillOrderFailed,
  fulfillOrderPaid,
  fulfillOrderRefunded,
  fulfillSubscriptionActivated,
  fulfillSubscriptionCancelScheduled,
  fulfillSubscriptionDowngraded,
  fulfillSubscriptionPaymentFailed,
  fulfillSubscriptionRenewed,
  fulfillSubscriptionRenewalFailed,
} from "@/lib/payment-fulfillment"

interface HilowWebhookCustomData {
  type?: "order" | "subscription"
  orderId?: string
  orderNumber?: string
  planId?: string
  planSlug?: string
  userId?: string
  referralCodeId?: string
  referralDiscountPercent?: number
}

interface HilowWebhookPayload {
  eventType?: string
  event?: string
  type?: string
  status?: string
  transactionId?: string
  hilowOrderId?: string
  internalOrderId?: string
  subscriptionId?: string
  customerEmail?: string
  customerName?: string
  customerId?: string
  amountInCents?: number
  refundedAmountInCents?: number
  isFullRefund?: boolean
  attemptCount?: number
  nextPaymentAttempt?: string
  currentPeriodEnd?: string | number
  cancelAtPeriodEnd?: boolean
  disputeReason?: string
  reason?: string
  metadata?: HilowWebhookCustomData | null
  custom?: HilowWebhookCustomData | null
}

function resolveEventType(payload: HilowWebhookPayload): string {
  const explicit = String(
    payload.eventType || payload.event || payload.type || ""
  )
    .toLowerCase()
    .trim()
  if (explicit) return explicit

  const status = String(payload.status || "").toLowerCase().trim()
  if (["completed", "paid", "succeeded", "success"].includes(status)) {
    return "payment.completed"
  }
  if (["failed", "failure", "error"].includes(status)) {
    return "payment.failed"
  }
  return ""
}

function extractContext(payload: HilowWebhookPayload): HilowWebhookCustomData {
  const fromCustom =
    payload.custom && typeof payload.custom === "object" ? payload.custom : {}
  const fromMetadata =
    payload.metadata && typeof payload.metadata === "object"
      ? payload.metadata
      : {}
  return { ...fromMetadata, ...fromCustom }
}

/**
 * Healthcheck endpoint for Hilow webhook configuration verification.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    gateway: "hilow",
    apiConfigured: isHilowConfigured(),
    webhookSecretConfigured: isHilowWebhookConfigured(),
  })
}

/**
 * Hilow Global webhook endpoint.
 * Always remains active in parallel with EasierPay so existing subscriptions keep
 * renewing/cancelling seamlessly even when the primary processor toggle is switched.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signatureHeader =
      request.headers.get("hilow-signature") ||
      request.headers.get("x-hilow-signature")

    const verification = verifyHilowWebhookSignature(rawBody, signatureHeader)
    if (!verification.valid) {
      const status =
        verification.reason === "HILOW_WEBHOOK_SECRET not configured" ? 503 : 401
      console.warn(`[Hilow Webhook] Rejected request: ${verification.reason}`)
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status }
      )
    }

    let payload: HilowWebhookPayload
    try {
      payload = JSON.parse(rawBody) as HilowWebhookPayload
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      )
    }

    const eventType = resolveEventType(payload)
    const context = extractContext(payload)
    const transactionId = String(
      payload.transactionId || payload.hilowOrderId || payload.internalOrderId || ""
    ).trim()
    const subscriptionId = payload.subscriptionId
      ? String(payload.subscriptionId).trim()
      : null

    const internalOrderId = String(payload.internalOrderId || "").trim()
    const inferredType: "order" | "subscription" | null =
      context.type === "order" || context.type === "subscription"
        ? context.type
        : Boolean(subscriptionId) ||
          eventType.startsWith("subscription.") ||
          eventType.includes("renewal") ||
          internalOrderId.startsWith("SUB_")
        ? "subscription"
        : context.orderId || internalOrderId.startsWith("ORD_")
        ? "order"
        : null

    console.log(
      `[Hilow Webhook] event=${eventType} type=${inferredType || "unknown"} tx=${transactionId || "n/a"} sub=${subscriptionId || "n/a"}`
    )

    if (inferredType === "order") {
      await handleOrderEvent(eventType, payload, context, transactionId)
    } else if (inferredType === "subscription") {
      await handleSubscriptionEvent(
        eventType,
        payload,
        context,
        transactionId,
        subscriptionId
      )
    } else {
      console.warn("[Hilow Webhook] Unable to determine order/subscription type; ignoring")
    }

    return NextResponse.json({ received: true, eventType })
  } catch (error) {
    console.error("[Hilow Webhook] Processing error:", error)
    return NextResponse.json(
      { error: "Webhook processing error" },
      { status: 500 }
    )
  }
}

async function resolveOrderIdFromPayload(
  payload: HilowWebhookPayload,
  context: HilowWebhookCustomData
): Promise<string | null> {
  if (context.orderId) return context.orderId

  if (payload.hilowOrderId) {
    const byTx = await prisma.order.findFirst({
      where: { transactionId: String(payload.hilowOrderId).trim() },
      select: { id: true },
    })
    if (byTx) return byTx.id
  }

  const orderNumber =
    context.orderNumber ||
    (() => {
      const m = String(payload.internalOrderId || "").match(/^ORD_(.+)_\d+$/)
      return m ? m[1] : ""
    })()

  if (orderNumber) {
    const byNum = await prisma.order.findUnique({
      where: { orderNumber },
      select: { id: true },
    })
    if (byNum) return byNum.id
  }

  return null
}

async function handleOrderEvent(
  eventType: string,
  payload: HilowWebhookPayload,
  context: HilowWebhookCustomData,
  transactionId: string
) {
  const orderId = await resolveOrderIdFromPayload(payload, context)
  if (!orderId) {
    console.warn("[Hilow Webhook] Order event missing metadata.orderId")
    return
  }

  switch (eventType) {
    case "payment.completed":
    case "payment.succeeded":
    case "payment.success":
      await fulfillOrderPaid({
        orderId,
        paymentGateway: "hilow",
        transactionId: transactionId || `hilow_${Date.now()}`,
      })
      break

    case "payment.failed":
    case "payment.failure":
    case "payment.error":
      await fulfillOrderFailed({
        orderId,
        paymentGateway: "hilow",
        transactionId: transactionId || undefined,
      })
      break

    case "payment.refunded":
      await fulfillOrderRefunded({
        orderId,
        paymentGateway: "hilow",
        isChargeback: false,
        reason: payload.reason,
      })
      break

    case "payment.chargeback":
      await fulfillOrderRefunded({
        orderId,
        paymentGateway: "hilow",
        isChargeback: true,
        reason: payload.disputeReason || payload.reason,
      })
      break

    default:
      console.log(`[Hilow Webhook] Unhandled order event: ${eventType}`)
  }
}

async function handleSubscriptionEvent(
  eventType: string,
  payload: HilowWebhookPayload,
  context: HilowWebhookCustomData,
  transactionId: string,
  subscriptionId: string | null
) {
  let userId = context.userId || payload.customerId || null
  if (!userId && subscriptionId) {
    userId = await findUserIdByHilowSubscriptionId(subscriptionId)
  }
  if (!userId && payload.internalOrderId) {
    const subMatch = String(payload.internalOrderId).match(/^SUB_([^_]+)_/)
    if (subMatch) userId = subMatch[1]
  }
  if (!userId) {
    console.warn("[Hilow Webhook] Subscription event missing userId")
    return
  }

  switch (eventType) {
    case "payment.completed":
    case "payment.succeeded":
    case "payment.success":
      if (!context.planId) {
        console.warn("[Hilow Webhook] Subscription activation missing planId")
        return
      }
      await fulfillSubscriptionActivated({
        userId,
        planId: context.planId,
        paymentGateway: "hilow",
        transactionId: transactionId || `hilow_sub_${Date.now()}`,
        gatewaySubscriptionId: subscriptionId,
        hilowOrderId: payload.hilowOrderId || null,
        referralCodeId: context.referralCodeId || null,
        referralDiscountPercent: Number(context.referralDiscountPercent || 0),
        currentPeriodEnd: payload.currentPeriodEnd,
      })
      break

    case "payment.failed":
    case "payment.failure":
    case "payment.error":
      await fulfillSubscriptionPaymentFailed({
        userId,
        planId: context.planId || null,
        paymentGateway: "hilow",
        reason: payload.reason,
      })
      break

    case "payment.renewal_succeeded":
    case "payment.renewed":
      await fulfillSubscriptionRenewed({
        userId,
        planId: context.planId || null,
        paymentGateway: "hilow",
        transactionId: transactionId || `hilow_ren_${Date.now()}`,
        gatewaySubscriptionId: subscriptionId,
        currentPeriodEnd: payload.currentPeriodEnd,
      })
      break

    case "payment.renewal_failed":
      await fulfillSubscriptionRenewalFailed({
        userId,
        planId: context.planId || null,
        paymentGateway: "hilow",
        attemptCount: payload.attemptCount,
        nextPaymentAttempt: payload.nextPaymentAttempt,
      })
      break

    case "subscription.cancel_scheduled":
      await fulfillSubscriptionCancelScheduled({
        userId,
        planId: context.planId || null,
        paymentGateway: "hilow",
        gatewaySubscriptionId: subscriptionId,
        currentPeriodEnd: payload.currentPeriodEnd,
      })
      break

    case "subscription.cancelled":
    case "subscription.canceled":
      // If cancelAtPeriodEnd is true, keep access until period end; otherwise cycle expired or immediate cancel
      if (payload.cancelAtPeriodEnd) {
        await fulfillSubscriptionCancelScheduled({
          userId,
          planId: context.planId || null,
          paymentGateway: "hilow",
          gatewaySubscriptionId: subscriptionId,
          currentPeriodEnd: payload.currentPeriodEnd,
        })
      } else {
        await fulfillSubscriptionDowngraded({
          userId,
          paymentGateway: "hilow",
          gatewaySubscriptionId: subscriptionId,
          reason: "Fin de periodo de suscripción",
          notifyAdmin: true,
        })
      }
      break

    case "payment.refunded":
    case "payment.chargeback":
      await fulfillSubscriptionDowngraded({
        userId,
        paymentGateway: "hilow",
        gatewaySubscriptionId: subscriptionId,
        reason:
          eventType === "payment.chargeback"
            ? `Contracargo${payload.disputeReason ? `: ${payload.disputeReason}` : ""}`
            : "Reembolso de suscripción",
        notifyAdmin: true,
      })
      break

    default:
      console.log(`[Hilow Webhook] Unhandled subscription event: ${eventType}`)
  }
}
