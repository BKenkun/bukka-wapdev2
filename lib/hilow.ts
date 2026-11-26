import crypto from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getPaymentBaseUrl } from "@/lib/payment-settings"

// ─── Types & Errors ──────────────────────────────────────────────────

export class HilowGatewayError extends Error {
  statusCode: number
  gatewayMessage: string

  constructor(statusCode: number, gatewayMessage: string) {
    super(gatewayMessage)
    this.name = "HilowGatewayError"
    this.statusCode = statusCode
    this.gatewayMessage = gatewayMessage
  }
}

export interface HilowConfig {
  apiKey: string
  webhookSecret: string
  storeId: string
  currency: string
  apiBaseUrl: string
  payOrigin: string
  baseUrl: string
}

export interface CreateHilowOrderParams {
  internalOrderId: string
  amountInCents: number
  productName: string
  isSubscription: boolean
  currency?: string
  interval?: "day" | "week" | "month" | "year"
  rebillAmountInCents?: number
  customerEmail?: string
  customerName?: string
  customerId?: string
  metadata?: Record<string, unknown>
  successUrl: string
  cancelUrl: string
  webhookUrl: string
}

export interface CreateHilowOrderResult {
  hilowOrderId: string
  subscriptionId: string | null
  payLink: string
}

export interface HilowUserSubscriptionState {
  subscriptionId: string
  hilowOrderId?: string | null
  planId: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd?: string | null
  updatedAt: string
}

const HILOW_USER_SUB_KEY_PREFIX = "hilow_sub_user_"

// ─── Config ──────────────────────────────────────────────────────────

export function isHilowConfigured(): boolean {
  return Boolean(process.env.HILOW_API_KEY?.trim())
}

export function isHilowWebhookConfigured(): boolean {
  return Boolean(process.env.HILOW_WEBHOOK_SECRET?.trim())
}

export function getHilowConfig(): HilowConfig {
  const apiKey = process.env.HILOW_API_KEY?.trim() || ""
  if (!apiKey) {
    throw new Error("HILOW_API_KEY is not configured in environment variables")
  }

  const baseUrl = getPaymentBaseUrl()
  let defaultStoreId = "bukkakery.com"
  try {
    defaultStoreId = new URL(baseUrl).hostname
  } catch {
    defaultStoreId = "bukkakery.com"
  }

  const apiBaseUrl = (
    process.env.HILOW_API_BASE_URL?.trim() || "https://hilowglobal.com"
  ).replace(/\/+$/, "")

  const payOrigin = (
    process.env.HILOW_PAY_ORIGIN?.trim() || "https://hilowglobal.com"
  ).replace(/\/+$/, "")

  return {
    apiKey,
    webhookSecret: process.env.HILOW_WEBHOOK_SECRET?.trim() || "",
    storeId:
      process.env.HILOW_STORE_ID?.trim() ||
      process.env.HILOW_STORE_DOMAIN?.trim() ||
      defaultStoreId,
    currency: (process.env.HILOW_CURRENCY?.trim() || "EUR").toUpperCase(),
    apiBaseUrl,
    payOrigin,
    baseUrl,
  }
}

// ─── API Client ──────────────────────────────────────────────────────

/**
 * Creates a one-time or recurring order in Hilow Global and returns the hosted checkout URL.
 */
export async function createHilowOrder(
  params: CreateHilowOrderParams
): Promise<CreateHilowOrderResult> {
  const config = getHilowConfig()
  const amountInCents = Math.round(params.amountInCents)

  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    throw new Error("Invalid payment amount")
  }

  const payload: Record<string, unknown> = {
    storeId: config.storeId,
    internalOrderId: params.internalOrderId,
    amountInCents,
    currency: (params.currency || config.currency).toUpperCase(),
    productName: params.productName.slice(0, 140),
    isSubscription: Boolean(params.isSubscription),
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    webhookUrl: params.webhookUrl,
  }

  if (params.isSubscription) {
    payload.interval = params.interval || "month"
    if (
      typeof params.rebillAmountInCents === "number" &&
      Number.isFinite(params.rebillAmountInCents) &&
      params.rebillAmountInCents > 0
    ) {
      payload.rebillAmountInCents = Math.round(params.rebillAmountInCents)
    }
  }

  if (params.customerEmail) payload.customerEmail = params.customerEmail
  if (params.customerName) payload.customerName = params.customerName
  if (params.customerId) payload.customerId = params.customerId

  if (params.metadata) {
    // Hilow accepts both `metadata` and `custom` and echoes them in all webhooks
    payload.metadata = params.metadata
    payload.custom = params.metadata
  }

  const response = await fetch(`${config.apiBaseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const errorMsg =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
        ? data.error
        : `Hilow API error (${response.status})`
    throw new HilowGatewayError(response.status, errorMsg)
  }

  const hilowOrderId = String(
    data.hilowOrderId || data.id || data.orderId || ""
  ).trim()

  const subscriptionId =
    typeof data.subscriptionId === "string" && data.subscriptionId.trim()
      ? data.subscriptionId.trim()
      : null

  if (hilowOrderId) {
    return {
      hilowOrderId,
      subscriptionId,
      payLink: `${config.payOrigin}/pay/${encodeURIComponent(hilowOrderId)}`,
    }
  }

  if (
    typeof data.checkoutUrl === "string" &&
    data.checkoutUrl.startsWith("https://")
  ) {
    return {
      hilowOrderId: "",
      subscriptionId,
      payLink: data.checkoutUrl,
    }
  }

  throw new Error("Invalid response from Hilow payment gateway")
}

/**
 * Cancels a recurring Hilow subscription.
 * - immediate: false -> schedules cancellation at end of current billing period.
 * - immediate: true  -> cancels immediately (e.g. during upgrade/downgrade).
 */
export async function cancelHilowSubscription(
  subscriptionId: string,
  immediate: boolean = false
): Promise<Record<string, unknown>> {
  const config = getHilowConfig()

  if (!subscriptionId.trim()) {
    throw new Error("subscriptionId is required")
  }

  const response = await fetch(`${config.apiBaseUrl}/api/subscriptions/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      subscriptionId: subscriptionId.trim(),
      immediate: Boolean(immediate),
    }),
  })

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const errorMsg =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
        ? data.error
        : `Hilow cancel subscription error (${response.status})`
    throw new HilowGatewayError(response.status, errorMsg)
  }

  return data
}

/**
 * Retrieves current subscription details from Hilow.
 */
export async function getHilowSubscription(
  subscriptionId: string
): Promise<Record<string, unknown>> {
  const config = getHilowConfig()

  const response = await fetch(
    `${config.apiBaseUrl}/api/subscriptions/${encodeURIComponent(subscriptionId.trim())}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    }
  )

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    const errorMsg =
      typeof data.message === "string"
        ? data.message
        : typeof data.error === "string"
        ? data.error
        : `Hilow subscription lookup error (${response.status})`
    throw new HilowGatewayError(response.status, errorMsg)
  }

  return data
}

// ─── Webhook HMAC-SHA256 Verification ────────────────────────────────

function normalizeHexSignature(value: string): string {
  return value.trim().replace(/^sha256=/i, "").trim().toLowerCase()
}

export function verifyHilowWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): { valid: boolean; reason?: string } {
  const secret = process.env.HILOW_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return { valid: false, reason: "HILOW_WEBHOOK_SECRET not configured" }
  }

  if (!signatureHeader || !signatureHeader.trim()) {
    return { valid: false, reason: "Missing signature header" }
  }

  const received = normalizeHexSignature(signatureHeader)
  if (!received || !/^[a-f0-9]+$/i.test(received)) {
    return { valid: false, reason: "Malformed signature header" }
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")
    .toLowerCase()

  const a = Buffer.from(received, "utf8")
  const b = Buffer.from(expected, "utf8")

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "Signature mismatch" }
  }

  return { valid: true }
}

// ─── Hilow Subscription State Persistence (SiteSettings, zero schema migration) ───

function userSubKey(userId: string): string {
  return `${HILOW_USER_SUB_KEY_PREFIX}${userId}`
}

export async function getUserHilowSubscription(
  userId: string
): Promise<HilowUserSubscriptionState | null> {
  try {
    const record = await prisma.siteSettings.findUnique({
      where: { key: userSubKey(userId) },
    })
    if (!record || !record.value || typeof record.value !== "object") {
      return null
    }
    const val = record.value as Record<string, unknown>
    if (typeof val.subscriptionId !== "string" || !val.subscriptionId) {
      return null
    }
    return {
      subscriptionId: val.subscriptionId,
      hilowOrderId: typeof val.hilowOrderId === "string" ? val.hilowOrderId : null,
      planId: typeof val.planId === "string" ? val.planId : "",
      cancelAtPeriodEnd: Boolean(val.cancelAtPeriodEnd),
      currentPeriodEnd:
        typeof val.currentPeriodEnd === "string" ? val.currentPeriodEnd : null,
      updatedAt:
        typeof val.updatedAt === "string"
          ? val.updatedAt
          : record.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error("[Hilow] Error loading user subscription state:", error)
    return null
  }
}

export async function saveUserHilowSubscription(
  userId: string,
  state: Omit<HilowUserSubscriptionState, "updatedAt">
): Promise<void> {
  const payload: HilowUserSubscriptionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  }

  const jsonValue = payload as unknown as Prisma.InputJsonValue

  await prisma.siteSettings.upsert({
    where: { key: userSubKey(userId) },
    create: {
      key: userSubKey(userId),
      value: jsonValue,
    },
    update: {
      value: jsonValue,
    },
  })
}

export async function clearUserHilowSubscription(userId: string): Promise<void> {
  await prisma.siteSettings
    .delete({
      where: { key: userSubKey(userId) },
    })
    .catch(() => undefined)
}

export async function findUserIdByHilowSubscriptionId(
  subscriptionId: string
): Promise<string | null> {
  const cleanId = subscriptionId.trim()
  if (!cleanId) return null

  try {
    const records = await prisma.siteSettings.findMany({
      where: {
        key: { startsWith: HILOW_USER_SUB_KEY_PREFIX },
      },
      select: { key: true, value: true },
    })

    for (const record of records) {
      if (record.value && typeof record.value === "object") {
        const val = record.value as Record<string, unknown>
        if (val.subscriptionId === cleanId) {
          return record.key.slice(HILOW_USER_SUB_KEY_PREFIX.length) || null
        }
      }
    }
  } catch (error) {
    console.error("[Hilow] Error looking up user by subscriptionId:", error)
  }

  return null
}

// ─── Live Connection Diagnostics (Non-Secret) ────────────────────────

export interface HilowConnectionDiagnostics {
  apiConfigured: boolean
  webhookSecretConfigured: boolean
  storeId: string
  baseUrl: string
  apiBaseUrl: string
  webhookUrl: string
  apiOrdersProbe: {
    reachable: boolean
    authenticated: boolean
    merchantEnabled: boolean
    statusCode: number | null
    message: string
  }
  apiSubscriptionProbe: {
    reachable: boolean
    statusCode: number | null
    message: string
  }
  webhookSignatureSelfTest: {
    passed: boolean
    reason: string
  }
  webhookPublicReachability: {
    reachable: boolean
    statusCode: number | null
    message: string
  }
}

export async function verifyHilowConnections(): Promise<HilowConnectionDiagnostics> {
  const apiConfigured = isHilowConfigured()
  const webhookSecretConfigured = isHilowWebhookConfigured()
  const baseUrl = getPaymentBaseUrl()
  const webhookUrl = `${baseUrl}/api/webhooks/hilow`

  let fallbackHost = "bukkakery.com"
  try {
    fallbackHost = new URL(baseUrl).hostname
  } catch {
    fallbackHost = "bukkakery.com"
  }

  const storeId =
    process.env.HILOW_STORE_ID?.trim() ||
    process.env.HILOW_STORE_DOMAIN?.trim() ||
    fallbackHost

  const apiBaseUrl = (
    process.env.HILOW_API_BASE_URL?.trim() || "https://hilowglobal.com"
  ).replace(/\/+$/, "")

  // 1. Webhook HMAC self-test (in-memory, never leaks secret)
  let webhookSignatureSelfTest = {
    passed: false,
    reason: "HILOW_WEBHOOK_SECRET no configurada",
  }
  if (webhookSecretConfigured) {
    const sampleBody = JSON.stringify({ eventType: "healthcheck.ping", ts: Date.now() })
    const secret = process.env.HILOW_WEBHOOK_SECRET!.trim()
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(sampleBody, "utf8")
      .digest("hex")
    const validCheck = verifyHilowWebhookSignature(sampleBody, expectedSig)
    const rejectCheck = verifyHilowWebhookSignature(sampleBody, "0".repeat(64))
    webhookSignatureSelfTest =
      validCheck.valid && !rejectCheck.valid
        ? { passed: true, reason: "Firma HMAC-SHA256 verificada correctamente" }
        : {
            passed: false,
            reason: validCheck.reason || "Error en verificación HMAC-SHA256",
          }
  }

  // 2. Public webhook URL reachability check
  let webhookPublicReachability: HilowConnectionDiagnostics["webhookPublicReachability"] = {
    reachable: false,
    statusCode: null,
    message: "No comprobado",
  }
  try {
    const res = await fetch(webhookUrl, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    })
    if (res.status === 200) {
      const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
      const isExpectedHealth = json?.gateway === "hilow" && json?.ok === true
      webhookPublicReachability = {
        reachable: isExpectedHealth,
        statusCode: res.status,
        message: isExpectedHealth
          ? "Endpoint público accesible (200 OK)"
          : "Responde 200 pero el payload no coincide con el healthcheck de Hilow",
      }
    } else if (res.status >= 300 && res.status < 400) {
      webhookPublicReachability = {
        reachable: false,
        statusCode: res.status,
        message: `Redirección (${res.status}): la URL no es accesible públicamente sin autenticación (normal en preview privado de AI Studio).`,
      }
    } else {
      webhookPublicReachability = {
        reachable: false,
        statusCode: res.status,
        message: `Respuesta HTTP ${res.status}`,
      }
    }
  } catch (error) {
    webhookPublicReachability = {
      reachable: false,
      statusCode: null,
      message: error instanceof Error ? error.message : "Error de red al verificar webhookUrl",
    }
  }

  // 3. Hilow API probes
  let apiOrdersProbe: HilowConnectionDiagnostics["apiOrdersProbe"] = {
    reachable: false,
    authenticated: false,
    merchantEnabled: false,
    statusCode: null,
    message: "HILOW_API_KEY no configurada",
  }

  let apiSubscriptionProbe: HilowConnectionDiagnostics["apiSubscriptionProbe"] = {
    reachable: false,
    statusCode: null,
    message: "HILOW_API_KEY no configurada",
  }

  if (apiConfigured) {
    const apiKey = process.env.HILOW_API_KEY!.trim()

    // 3a. Probe POST /api/orders with amountInCents: 0 (avoids creating an active order while testing auth + merchant status)
    try {
      const res = await fetch(`${apiBaseUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          storeId,
          internalOrderId: `HEALTHCHECK_${Date.now()}`,
          amountInCents: 0,
          currency: (process.env.HILOW_CURRENCY?.trim() || "EUR").toUpperCase(),
          productName: "Connection Healthcheck",
          isSubscription: false,
          successUrl: `${baseUrl}/checkout/resultado?order=TEST&status=success`,
          cancelUrl: `${baseUrl}/checkout/resultado?order=TEST&status=failed`,
          webhookUrl,
        }),
        signal: AbortSignal.timeout(10000),
      })
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
      const msg =
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
          ? data.error
          : `HTTP ${res.status}`

      const isUnauthorized = res.status === 401
      const isDisabled = /disabled for this merchant/i.test(msg)
      // If auth succeeded and merchant isn't disabled, Hilow typically returns 400 validation error for amountInCents: 0
      const merchantEnabled = !isUnauthorized && !isDisabled

      apiOrdersProbe = {
        reachable: true,
        authenticated: !isUnauthorized,
        merchantEnabled,
        statusCode: res.status,
        message: msg,
      }
    } catch (error) {
      apiOrdersProbe = {
        reachable: false,
        authenticated: false,
        merchantEnabled: false,
        statusCode: null,
        message: error instanceof Error ? error.message : "Error de conexión con Hilow /api/orders",
      }
    }

    // 3b. Probe GET /api/subscriptions/{id}
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/subscriptions/hlw_sub_healthcheck_probe`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(10000),
        }
      )
      const contentType = res.headers.get("content-type") || ""
      let msg = `HTTP ${res.status}`
      if (contentType.includes("application/json")) {
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (typeof data.message === "string") msg = data.message
        else if (typeof data.error === "string") msg = data.error
      }
      apiSubscriptionProbe = {
        reachable: true,
        statusCode: res.status,
        message: msg,
      }
    } catch (error) {
      apiSubscriptionProbe = {
        reachable: false,
        statusCode: null,
        message:
          error instanceof Error
            ? error.message
            : "Error de conexión con Hilow /api/subscriptions",
      }
    }
  }

  return {
    apiConfigured,
    webhookSecretConfigured,
    storeId,
    baseUrl,
    apiBaseUrl,
    webhookUrl,
    apiOrdersProbe,
    apiSubscriptionProbe,
    webhookSignatureSelfTest,
    webhookPublicReachability,
  }
}
