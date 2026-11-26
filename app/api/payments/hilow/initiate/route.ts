import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : ""

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // Registered user orders require the matching authenticated owner
    if (order.userId) {
      if (!session?.user?.id || order.userId !== session.user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    if (order.paymentStatus !== "PENDING") {
      return NextResponse.json(
        { error: "This order has already been processed" },
        { status: 400 }
      )
    }

    const totalEur = Number(order.total)
    const amountInCents = Math.round(totalEur * 100)
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      return NextResponse.json(
        { error: "Invalid order total" },
        { status: 400 }
      )
    }

    const config = getHilowConfig()
    const internalOrderId = `ORD_${order.orderNumber}_${Date.now()}`
    const customerEmail = order.user?.email || order.guestEmail || undefined
    const customerName =
      order.user?.name || order.guestName || session?.user?.name || "Customer"

    const result = await createHilowOrder({
      internalOrderId,
      amountInCents,
      currency: config.currency,
      productName: `Order ${order.orderNumber}`,
      isSubscription: false,
      customerEmail,
      customerName,
      customerId: order.userId || order.id,
      metadata: {
        type: "order",
        orderId: order.id,
        orderNumber: order.orderNumber,
      },
      successUrl: `${config.baseUrl}/checkout/resultado?order=${encodeURIComponent(order.orderNumber)}&status=success`,
      cancelUrl: `${config.baseUrl}/checkout/resultado?order=${encodeURIComponent(order.orderNumber)}&status=failed`,
      webhookUrl: `${config.baseUrl}/api/webhooks/hilow`,
    })

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentGateway: "hilow",
        ...(result.hilowOrderId ? { transactionId: result.hilowOrderId } : {}),
      },
    })

    return NextResponse.json({
      payLink: result.payLink,
      gateway: "hilow",
      hilowOrderId: result.hilowOrderId,
    })
  } catch (error) {
    if (error instanceof HilowGatewayError) {
      console.warn(`[Hilow] Order initiation rejected (${error.statusCode}): ${error.gatewayMessage}`)
      if (/disabled for this merchant/i.test(error.gatewayMessage)) {
        return NextResponse.json(
          {
            error: "Payment gateway service is temporarily unavailable for card payments.",
            code: "HILOW_MERCHANT_DISABLED",
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        {
          error: error.gatewayMessage || "Failed to initiate Hilow payment",
          code: "HILOW_GATEWAY_ERROR",
        },
        { status: error.statusCode >= 400 && error.statusCode < 500 ? 400 : 502 }
      )
    }

    console.error("[Hilow] Error initiating order payment:", error)
    return NextResponse.json(
      { error: "Failed to initiate Hilow payment" },
      { status: 502 }
    )
  }
}
