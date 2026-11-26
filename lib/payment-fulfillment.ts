import { prisma } from "@/lib/prisma"
import {
  sendTemplateEmail,
  PaymentReceivedTemplate,
  PaymentFailedTemplate,
  SubscriptionActivatedTemplate,
  SubscriptionRenewedTemplate,
  SubscriptionCancelledTemplate,
  SubscriptionPaymentFailedTemplate,
} from "@/lib/email"
import { createAdminNotification } from "@/lib/admin-notifications"
import { formatPaymentGatewayLabel, type PaymentProcessor } from "@/lib/payment-settings"
import {
  clearUserHilowSubscription,
  getUserHilowSubscription,
  saveUserHilowSubscription,
  cancelHilowSubscription,
} from "@/lib/hilow"

// ─── Shared Referral Attribution ─────────────────────────────────────

interface AttributeReferralInput {
  referralCodeId: string
  type: "SHOP_PURCHASE" | "SUBSCRIPTION"
  userId: string | null
  orderId?: string
  subscriptionHistoryId?: string
  amount: number
  discountAmount: number
}

export async function attributePaymentReferral(input: AttributeReferralInput) {
  try {
    await prisma.$transaction(async (tx) => {
      if (input.orderId) {
        const existing = await tx.referralConversion.findUnique({
          where: { orderId: input.orderId },
        })
        if (existing) return
      }
      if (input.subscriptionHistoryId) {
        const existing = await tx.referralConversion.findUnique({
          where: { subscriptionHistoryId: input.subscriptionHistoryId },
        })
        if (existing) return
      }

      const code = await tx.referralCode.findUnique({
        where: { id: input.referralCodeId },
        select: { commissionPercent: true },
      })
      const commissionPercent = Number(code?.commissionPercent ?? 0)
      const commissionAmount =
        commissionPercent > 0
          ? Math.round(input.amount * commissionPercent) / 100
          : 0

      await tx.referralConversion.create({
        data: {
          referralCodeId: input.referralCodeId,
          type: input.type,
          userId: input.userId,
          orderId: input.orderId,
          subscriptionHistoryId: input.subscriptionHistoryId,
          amount: input.amount,
          discountAmount: input.discountAmount,
          commissionAmount,
        },
      })

      await tx.referralCode.update({
        where: { id: input.referralCodeId },
        data: {
          usedCount: { increment: 1 },
          totalRevenue: { increment: input.amount },
        },
      })
    })
  } catch (err) {
    console.error("[Payments] Referral attribution error:", err)
  }
}

// ─── Order Fulfillment ───────────────────────────────────────────────

export async function fulfillOrderPaid(params: {
  orderId: string
  paymentGateway: PaymentProcessor
  transactionId: string
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!order) {
    console.error(`[Payments] Order not found: ${params.orderId}`)
    return { handled: false, reason: "order_not_found" as const }
  }

  // Idempotency: do not re-process already paid orders
  if (order.paymentStatus === "PAID") {
    return { handled: true, duplicate: true as const }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      paymentGateway: params.paymentGateway,
      transactionId: params.transactionId,
    },
  })

  if (order.referralCodeId) {
    await attributePaymentReferral({
      referralCodeId: order.referralCodeId,
      type: "SHOP_PURCHASE",
      userId: order.userId,
      orderId: order.id,
      amount: Number(order.total),
      discountAmount: Number(order.discount),
    })
  }

  const userName = order.user?.name || order.guestName || "Cliente"
  const userEmail = order.user?.email || order.guestEmail
  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  if (userEmail) {
    await sendTemplateEmail({
      to: userEmail,
      template: "orders/payment-received",
      subjectVariables: { orderNumber: order.orderNumber },
      react: PaymentReceivedTemplate({
        customerName: userName,
        orderNumber: order.orderNumber,
        amount: Number(order.total),
        paymentMethod: gatewayLabel,
        transactionId: params.transactionId,
      }),
      metadata: { orderId: order.id },
    })
  }

  await createAdminNotification({
    type: "ORDER_PAID",
    title: `Pago recibido (${gatewayLabel}) · Pedido #${order.orderNumber}`,
    message: `${Number(order.total).toFixed(2)} € · ${userName}`,
    relatedUrl: `/admin/orders/${order.id}`,
  })

  return { handled: true, duplicate: false as const }
}

export async function fulfillOrderFailed(params: {
  orderId: string
  paymentGateway: PaymentProcessor
  transactionId?: string
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!order) {
    console.error(`[Payments] Order not found: ${params.orderId}`)
    return { handled: false }
  }

  // Never downgrade an order that was already paid
  if (order.paymentStatus === "PAID") {
    return { handled: true, duplicate: true }
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "FAILED",
      paymentGateway: params.paymentGateway,
      ...(params.transactionId ? { transactionId: params.transactionId } : {}),
    },
  })

  const userName = order.user?.name || order.guestName || "Cliente"
  const userEmail = order.user?.email || order.guestEmail
  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  if (userEmail) {
    await sendTemplateEmail({
      to: userEmail,
      template: "orders/payment-failed",
      subjectVariables: { orderNumber: order.orderNumber },
      react: PaymentFailedTemplate({
        customerName: userName,
        orderNumber: order.orderNumber,
        amount: Number(order.total),
      }),
      metadata: { orderId: order.id },
    })
  }

  await createAdminNotification({
    type: "PAYMENT_FAILED",
    title: `Pago fallido (${gatewayLabel}) · Pedido #${order.orderNumber}`,
    message: `${Number(order.total).toFixed(2)} € · ${userName}`,
    relatedUrl: `/admin/orders/${order.id}`,
  })

  return { handled: true }
}

export async function fulfillOrderRefunded(params: {
  orderId: string
  paymentGateway: PaymentProcessor
  isChargeback?: boolean
  reason?: string
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!order) return { handled: false }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: "REFUNDED" },
  })

  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)
  const userName = order.user?.name || order.guestName || "Cliente"

  await createAdminNotification({
    type: "PAYMENT_FAILED",
    title: params.isChargeback
      ? `Contracargo (${gatewayLabel}) · Pedido #${order.orderNumber}`
      : `Reembolso (${gatewayLabel}) · Pedido #${order.orderNumber}`,
    message: `${Number(order.total).toFixed(2)} € · ${userName}${params.reason ? ` · ${params.reason}` : ""}`,
    relatedUrl: `/admin/orders/${order.id}`,
  })

  return { handled: true }
}

// ─── Subscription Fulfillment ────────────────────────────────────────

function parseDateOrDefault(value: unknown, fallback: Date): Date {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value < 1e12 ? value * 1000 : value
    const parsed = new Date(ms)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim()
    if (/^\d{10,13}$/.test(trimmed)) {
      const num = Number(trimmed)
      const ms = num < 1e12 ? num * 1000 : num
      const parsed = new Date(ms)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed
      }
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return fallback
}

export async function fulfillSubscriptionActivated(params: {
  userId: string
  planId: string
  paymentGateway: PaymentProcessor
  transactionId: string
  gatewaySubscriptionId?: string | null
  hilowOrderId?: string | null
  referralCodeId?: string | null
  referralDiscountPercent?: number
  currentPeriodEnd?: string | number | null
}) {
  const [user, plan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.userId },
      include: { SubscriptionPlan: true },
    }),
    prisma.subscriptionPlan.findUnique({ where: { id: params.planId } }),
  ])

  if (!user || !plan) {
    console.error(
      `[Payments] Subscription activation missing user=${params.userId} or plan=${params.planId}`
    )
    return { handled: false }
  }

  // Idempotency: skip if this exact transaction was already recorded
  if (params.transactionId) {
    const existingTx = await prisma.subscriptionHistory.findFirst({
      where: {
        userId: user.id,
        paymentGateway: params.paymentGateway,
        transactionId: params.transactionId,
      },
      select: { id: true },
    })
    if (existingTx) {
      return { handled: true, duplicate: true }
    }
  }

  // If upgrading/changing plan on Hilow while a different Hilow subscription was active, cancel previous one immediately
  if (params.paymentGateway === "hilow" && params.gatewaySubscriptionId) {
    const previousHilowSub = await getUserHilowSubscription(user.id)
    if (
      previousHilowSub?.subscriptionId &&
      previousHilowSub.subscriptionId !== params.gatewaySubscriptionId
    ) {
      await cancelHilowSubscription(previousHilowSub.subscriptionId, true).catch((err) => {
        console.warn("[Hilow] Could not auto-cancel previous subscription on plan change:", err)
      })
    }
  }

  const now = new Date()
  const defaultEnd = new Date(now)
  defaultEnd.setDate(defaultEnd.getDate() + 30)
  const subscriptionEnd = parseDateOrDefault(params.currentPeriodEnd, defaultEnd)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlanId: plan.id,
      subscriptionStart: now,
      subscriptionEnd,
      ...(params.paymentGateway === "easierpay" && params.gatewaySubscriptionId
        ? { easierpaySubscriptionId: params.gatewaySubscriptionId }
        : {}),
    },
  })

  if (params.paymentGateway === "hilow" && params.gatewaySubscriptionId) {
    await saveUserHilowSubscription(user.id, {
      subscriptionId: params.gatewaySubscriptionId,
      hilowOrderId: params.hilowOrderId || null,
      planId: plan.id,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: subscriptionEnd.toISOString(),
    })
  }

  const monthlyPrice = Number(plan.monthlyPrice)
  const refDiscountPct = Number(params.referralDiscountPercent || 0)
  const chargedAmount =
    refDiscountPct > 0
      ? Math.max(0, Math.round(monthlyPrice * (1 - refDiscountPct / 100) * 100) / 100)
      : monthlyPrice
  const refDiscountAmount = Math.max(
    0,
    Math.round((monthlyPrice - chargedAmount) * 100) / 100
  )

  const history = await prisma.subscriptionHistory.create({
    data: {
      userId: user.id,
      planId: plan.id,
      startDate: now,
      endDate: subscriptionEnd,
      amount: chargedAmount,
      currency: "EUR",
      paymentGateway: params.paymentGateway,
      transactionId: params.transactionId,
      referralCodeId: params.referralCodeId || null,
    },
  })

  if (params.referralCodeId) {
    await attributePaymentReferral({
      referralCodeId: params.referralCodeId,
      type: "SUBSCRIPTION",
      userId: user.id,
      subscriptionHistoryId: history.id,
      amount: chargedAmount,
      discountAmount: refDiscountAmount,
    })
  }

  const features = Array.isArray(plan.features)
    ? (plan.features as { text: string; included: boolean }[])
        .filter((f) => f.included)
        .map((f) => f.text)
    : []

  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  await sendTemplateEmail({
    to: user.email,
    template: "subscriptions/activated",
    subjectVariables: { planName: plan.name },
    react: SubscriptionActivatedTemplate({
      customerName: user.name || "Cliente",
      planName: plan.name,
      features,
      startDate: now,
      nextBillingDate: subscriptionEnd,
      amount: monthlyPrice,
    }),
    metadata: { userId: user.id, planId: plan.id },
  })

  await createAdminNotification({
    type: "NEW_SUBSCRIPTION",
    title: `Nueva suscripción ${plan.name} (${gatewayLabel})`,
    message: user.email || `User ${user.id}`,
    relatedUrl: `/admin/users/${user.id}`,
  })

  return { handled: true, duplicate: false }
}

export async function fulfillSubscriptionPaymentFailed(params: {
  userId: string
  planId?: string | null
  paymentGateway: PaymentProcessor
  reason?: string
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { SubscriptionPlan: true },
  })
  if (!user) return { handled: false }

  const plan = params.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } })
    : user.SubscriptionPlan
  if (!plan) return { handled: false }

  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  await sendTemplateEmail({
    to: user.email,
    template: "subscriptions/payment-failed",
    subjectVariables: { planName: plan.name },
    react: SubscriptionPaymentFailedTemplate({
      customerName: user.name || "Cliente",
      planName: plan.name,
      amount: Number(plan.monthlyPrice),
      reason: params.reason || "We were unable to process your subscription payment",
    }),
    metadata: { userId: user.id, planId: plan.id },
  })

  await createAdminNotification({
    type: "PAYMENT_FAILED",
    title: `Pago de suscripción fallido (${gatewayLabel}) · ${plan.name}`,
    message: user.email,
    relatedUrl: `/admin/users/${user.id}`,
  })

  return { handled: true }
}

export async function fulfillSubscriptionRenewed(params: {
  userId: string
  planId?: string | null
  paymentGateway: PaymentProcessor
  transactionId: string
  gatewaySubscriptionId?: string | null
  currentPeriodEnd?: string | number | null
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { SubscriptionPlan: true },
  })
  if (!user) return { handled: false }

  const plan = params.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } })
    : user.SubscriptionPlan
  if (!plan) return { handled: false }

  // Idempotency check on transactionId
  if (params.transactionId) {
    const existingTx = await prisma.subscriptionHistory.findFirst({
      where: {
        userId: user.id,
        paymentGateway: params.paymentGateway,
        transactionId: params.transactionId,
      },
      select: { id: true },
    })
    if (existingTx) {
      return { handled: true, duplicate: true }
    }
  }

  const now = new Date()
  const currentEnd = user.subscriptionEnd || now
  const baseDate = currentEnd > now ? currentEnd : now
  const defaultNewEnd = new Date(baseDate)
  defaultNewEnd.setDate(defaultNewEnd.getDate() + 30)
  const newEnd = parseDateOrDefault(params.currentPeriodEnd, defaultNewEnd)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlanId: plan.id,
      subscriptionEnd: newEnd,
    },
  })

  if (params.paymentGateway === "hilow" && params.gatewaySubscriptionId) {
    const existingHilow = await getUserHilowSubscription(user.id)
    await saveUserHilowSubscription(user.id, {
      subscriptionId: params.gatewaySubscriptionId,
      hilowOrderId: existingHilow?.hilowOrderId || null,
      planId: plan.id,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: newEnd.toISOString(),
    })
  }

  const monthlyPrice = Number(plan.monthlyPrice)

  await prisma.subscriptionHistory.create({
    data: {
      userId: user.id,
      planId: plan.id,
      startDate: now,
      endDate: newEnd,
      amount: monthlyPrice,
      currency: "EUR",
      paymentGateway: params.paymentGateway,
      transactionId: params.transactionId,
    },
  })

  await sendTemplateEmail({
    to: user.email,
    template: "subscriptions/renewed",
    subjectVariables: { planName: plan.name },
    react: SubscriptionRenewedTemplate({
      customerName: user.name || "Cliente",
      planName: plan.name,
      renewedAt: now,
      nextBillingDate: newEnd,
      amount: monthlyPrice,
    }),
    metadata: { userId: user.id, planId: plan.id },
  })

  return { handled: true, duplicate: false }
}

export async function fulfillSubscriptionRenewalFailed(params: {
  userId: string
  planId?: string | null
  paymentGateway: PaymentProcessor
  attemptCount?: number
  nextPaymentAttempt?: string | null
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { SubscriptionPlan: true },
  })
  if (!user) return { handled: false }

  const plan = params.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } })
    : user.SubscriptionPlan
  if (!plan) return { handled: false }

  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  await sendTemplateEmail({
    to: user.email,
    template: "subscriptions/payment-failed",
    subjectVariables: { planName: plan.name },
    react: SubscriptionPaymentFailedTemplate({
      customerName: user.name || "Cliente",
      planName: plan.name,
      amount: Number(plan.monthlyPrice),
      reason: "We were unable to charge your monthly renewal",
    }),
    metadata: { userId: user.id, planId: plan.id },
  })

  const attemptText = params.attemptCount ? ` (intento #${params.attemptCount})` : ""
  await createAdminNotification({
    type: "PAYMENT_FAILED",
    title: `Renovación fallida (${gatewayLabel}) · ${plan.name}`,
    message: `${user.email}${attemptText} — ${gatewayLabel} reintentará automáticamente`,
    relatedUrl: `/admin/users/${user.id}`,
  })

  return { handled: true }
}

export async function fulfillSubscriptionCancelScheduled(params: {
  userId: string
  planId?: string | null
  paymentGateway: PaymentProcessor
  gatewaySubscriptionId?: string | null
  currentPeriodEnd?: string | number | null
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { SubscriptionPlan: true },
  })
  if (!user) return { handled: false }

  const plan = params.planId
    ? await prisma.subscriptionPlan.findUnique({ where: { id: params.planId } })
    : user.SubscriptionPlan
  if (!plan) return { handled: false }

  const endDate = parseDateOrDefault(
    params.currentPeriodEnd,
    user.subscriptionEnd || new Date()
  )

  if (params.paymentGateway === "hilow") {
    const existing = await getUserHilowSubscription(user.id)
    const subId = params.gatewaySubscriptionId || existing?.subscriptionId
    if (subId) {
      await saveUserHilowSubscription(user.id, {
        subscriptionId: subId,
        hilowOrderId: existing?.hilowOrderId || null,
        planId: plan.id,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: endDate.toISOString(),
      })
    }
  }

  const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)

  await sendTemplateEmail({
    to: user.email,
    template: "subscriptions/cancelled",
    subjectVariables: { planName: plan.name },
    react: SubscriptionCancelledTemplate({
      customerName: user.name || "Cliente",
      planName: plan.name,
      endDate,
    }),
    metadata: { userId: user.id, planId: plan.id },
  })

  await createAdminNotification({
    type: "SUBSCRIPTION_CANCELLED",
    title: `Suscripción cancelada (${gatewayLabel})`,
    message: `${user.email} · Activa hasta ${endDate.toLocaleDateString("es-ES")}`,
    relatedUrl: `/admin/users/${user.id}`,
  })

  return { handled: true }
}

export async function fulfillSubscriptionDowngraded(params: {
  userId: string
  paymentGateway: PaymentProcessor
  gatewaySubscriptionId?: string | null
  reason?: string
  notifyAdmin?: boolean
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, easierpaySubscriptionId: true },
  })
  if (!user) return { handled: false }

  // Guard against stale webhook from an old subscription after user already upgraded to a new one
  if (params.paymentGateway === "hilow" && params.gatewaySubscriptionId) {
    const currentHilow = await getUserHilowSubscription(user.id)
    if (
      currentHilow?.subscriptionId &&
      currentHilow.subscriptionId !== params.gatewaySubscriptionId
    ) {
      return { handled: true, skippedStaleSubscription: true }
    }
  }

  const defaultPlan = await prisma.subscriptionPlan.findFirst({
    where: { isActive: true, isDefault: true },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionPlanId: defaultPlan?.id || null,
      subscriptionEnd: null,
      ...(params.paymentGateway === "easierpay"
        ? { easierpaySubscriptionId: null }
        : {}),
    },
  })

  if (params.paymentGateway === "hilow") {
    await clearUserHilowSubscription(user.id)
  }

  if (params.notifyAdmin) {
    const gatewayLabel = formatPaymentGatewayLabel(params.paymentGateway)
    await createAdminNotification({
      type: "SUBSCRIPTION_CANCELLED",
      title: `Suscripción finalizada (${gatewayLabel})`,
      message: `${user.email}${params.reason ? ` · ${params.reason}` : ""}`,
      relatedUrl: `/admin/users/${user.id}`,
    })
  }

  return { handled: true }
}
