import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  getPaymentGatewaysDiagnostics,
  getPaymentProcessorSettings,
  savePaymentProcessorSettings,
  type PaymentProcessor,
} from "@/lib/payment-settings"
import { verifyHilowConnections } from "@/lib/hilow"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })

  if (!adminUser?.isAdmin) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  }

  return { userId: session.user.id }
}

export async function GET() {
  try {
    const authCheck = await requireAdmin()
    if (authCheck.error) return authCheck.error

    const [settings, diagnostics] = await Promise.all([
      getPaymentProcessorSettings(),
      Promise.resolve(getPaymentGatewaysDiagnostics()),
    ])

    return NextResponse.json({
      ...settings,
      diagnostics,
    })
  } catch (error) {
    console.error("[Admin Payments] Error fetching payment processor settings:", error)
    return NextResponse.json(
      { error: "Error al obtener la configuración de pagos" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck.error) return authCheck.error

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    }

    if (body.action === "test-hilow") {
      const hilowDiagnostics = await verifyHilowConnections()
      return NextResponse.json({
        success: true,
        hilowDiagnostics,
      })
    }

    const validProcessors = new Set<PaymentProcessor>(["easierpay", "hilow"])
    const shopProcessor = body.shopProcessor as PaymentProcessor | undefined
    const subscriptionProcessor = body.subscriptionProcessor as PaymentProcessor | undefined

    if (shopProcessor !== undefined && !validProcessors.has(shopProcessor)) {
      return NextResponse.json(
        { error: "Procesador de tienda no válido" },
        { status: 400 }
      )
    }

    if (
      subscriptionProcessor !== undefined &&
      !validProcessors.has(subscriptionProcessor)
    ) {
      return NextResponse.json(
        { error: "Procesador de suscripciones no válido" },
        { status: 400 }
      )
    }

    const saved = await savePaymentProcessorSettings({
      shopProcessor,
      subscriptionProcessor,
    })

    return NextResponse.json({
      success: true,
      ...saved,
      diagnostics: getPaymentGatewaysDiagnostics(),
    })
  } catch (error) {
    console.error("[Admin Payments] Error saving payment processor settings:", error)
    return NextResponse.json(
      { error: "Error al guardar la configuración de pagos" },
      { status: 500 }
    )
  }
}
