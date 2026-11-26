import { prisma } from "@/lib/prisma"

export type PaymentProcessor = "easierpay" | "hilow"

export interface PaymentProcessorSettings {
  shopProcessor: PaymentProcessor
  subscriptionProcessor: PaymentProcessor
}

export const PAYMENT_PROCESSOR_SETTINGS_KEY = "payment_processor_settings"

export const DEFAULT_PAYMENT_PROCESSOR_SETTINGS: PaymentProcessorSettings = {
  shopProcessor: "easierpay",
  subscriptionProcessor: "easierpay",
}

export function normalizePaymentProcessor(
  value: unknown,
  fallback: PaymentProcessor = "easierpay"
): PaymentProcessor {
  if (value === "hilow" || value === "easierpay") {
    return value
  }
  return fallback
}

export async function getPaymentProcessorSettings(): Promise<PaymentProcessorSettings> {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: PAYMENT_PROCESSOR_SETTINGS_KEY },
    })

    if (!setting || !setting.value || typeof setting.value !== "object") {
      return { ...DEFAULT_PAYMENT_PROCESSOR_SETTINGS }
    }

    const raw = setting.value as Record<string, unknown>
    return {
      shopProcessor: normalizePaymentProcessor(
        raw.shopProcessor,
        DEFAULT_PAYMENT_PROCESSOR_SETTINGS.shopProcessor
      ),
      subscriptionProcessor: normalizePaymentProcessor(
        raw.subscriptionProcessor,
        DEFAULT_PAYMENT_PROCESSOR_SETTINGS.subscriptionProcessor
      ),
    }
  } catch (error) {
    console.error("[Payments] Error reading payment processor settings:", error)
    return { ...DEFAULT_PAYMENT_PROCESSOR_SETTINGS }
  }
}

export async function savePaymentProcessorSettings(
  input: Partial<PaymentProcessorSettings>
): Promise<PaymentProcessorSettings> {
  const current = await getPaymentProcessorSettings()
  const next: PaymentProcessorSettings = {
    shopProcessor: normalizePaymentProcessor(
      input.shopProcessor,
      current.shopProcessor
    ),
    subscriptionProcessor: normalizePaymentProcessor(
      input.subscriptionProcessor,
      current.subscriptionProcessor
    ),
  }

  await prisma.siteSettings.upsert({
    where: { key: PAYMENT_PROCESSOR_SETTINGS_KEY },
    create: {
      key: PAYMENT_PROCESSOR_SETTINGS_KEY,
      value: next as unknown as Record<string, string>,
    },
    update: {
      value: next as unknown as Record<string, string>,
    },
  })

  return next
}

export function getPaymentBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://bukkakery.com"
  return raw.replace(/\/+$/, "")
}

export interface PaymentGatewaysDiagnostics {
  baseUrl: string
  easierpay: {
    apiConfigured: boolean
    testMode: boolean
    commerce: string
    webhookUrl: string
  }
  hilow: {
    apiConfigured: boolean
    webhookSecretConfigured: boolean
    storeId: string
    webhookUrl: string
  }
}

export function getPaymentGatewaysDiagnostics(): PaymentGatewaysDiagnostics {
  const baseUrl = getPaymentBaseUrl()
  let fallbackHost = "bukkakery.com"
  try {
    fallbackHost = new URL(baseUrl).hostname
  } catch {
    fallbackHost = "bukkakery.com"
  }

  return {
    baseUrl,
    easierpay: {
      apiConfigured: Boolean(process.env.EASIERPAY_BEARER_TOKEN?.trim()),
      testMode: process.env.EASIERPAY_TEST_MODE !== "false",
      commerce: process.env.EASIERPAY_COMMERCE?.trim() || fallbackHost,
      webhookUrl: `${baseUrl}/api/webhooks/easierpay`,
    },
    hilow: {
      apiConfigured: Boolean(process.env.HILOW_API_KEY?.trim()),
      webhookSecretConfigured: Boolean(process.env.HILOW_WEBHOOK_SECRET?.trim()),
      storeId:
        process.env.HILOW_STORE_ID?.trim() ||
        process.env.HILOW_STORE_DOMAIN?.trim() ||
        fallbackHost,
      webhookUrl: `${baseUrl}/api/webhooks/hilow`,
    },
  }
}

export function formatPaymentGatewayLabel(gateway?: string | null): string {
  const normalized = (gateway || "").trim().toLowerCase()
  if (normalized === "hilow") return "Hilow Global"
  if (normalized === "easierpay") return "EasierPay"
  return gateway || "Not configured"
}
