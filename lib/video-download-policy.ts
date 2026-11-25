export type DownloadDelayUnit = "days" | "weeks" | "months"

export interface VideoDownloadPolicy {
  enabled: boolean
  delayValue: number
  delayUnit: DownloadDelayUnit
}

export type VideoDownloadOverrideMode =
  | "default"
  | "immediate"
  | "disabled"
  | "custom_date"

export interface VideoDownloadOverride {
  mode: VideoDownloadOverrideMode
  availableAt?: string | null
}

export type VideoDownloadAvailabilityReason =
  | "AVAILABLE"
  | "LOCKED_BY_DELAY"
  | "LOCKED_BY_CUSTOM_DATE"
  | "DISABLED"

export interface VideoDownloadAvailability {
  isAvailable: boolean
  reason: VideoDownloadAvailabilityReason
  availableAt: Date | null
  daysRemaining: number
  baseDate: Date
}

export const DEFAULT_VIDEO_DOWNLOAD_POLICY: VideoDownloadPolicy = {
  enabled: true,
  delayValue: 3,
  delayUnit: "months",
}

export const DEFAULT_VIDEO_DOWNLOAD_OVERRIDE: VideoDownloadOverride = {
  mode: "default",
  availableAt: null,
}

export const MAX_DOWNLOAD_DELAY_BY_UNIT: Record<DownloadDelayUnit, number> = {
  days: 3650,
  weeks: 520,
  months: 120,
}

export const DOWNLOAD_DELAY_PRESETS: Array<{
  label: string
  enabled: boolean
  delayValue: number
  delayUnit: DownloadDelayUnit
}> = [
  { label: "Sin espera", enabled: false, delayValue: 0, delayUnit: "days" },
  { label: "7 días", enabled: true, delayValue: 7, delayUnit: "days" },
  { label: "15 días", enabled: true, delayValue: 15, delayUnit: "days" },
  { label: "1 mes", enabled: true, delayValue: 1, delayUnit: "months" },
  { label: "2 meses", enabled: true, delayValue: 2, delayUnit: "months" },
  { label: "3 meses", enabled: true, delayValue: 3, delayUnit: "months" },
  { label: "6 meses", enabled: true, delayValue: 6, delayUnit: "months" },
  { label: "1 año", enabled: true, delayValue: 12, delayUnit: "months" },
]

const VALID_UNITS: DownloadDelayUnit[] = ["days", "weeks", "months"]
const VALID_OVERRIDE_MODES: VideoDownloadOverrideMode[] = [
  "default",
  "immediate",
  "disabled",
  "custom_date",
]

export function sanitizeVideoDownloadPolicy(raw: unknown): VideoDownloadPolicy {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VIDEO_DOWNLOAD_POLICY }
  }

  const obj = raw as Record<string, unknown>
  const enabled =
    typeof obj.enabled === "boolean"
      ? obj.enabled
      : DEFAULT_VIDEO_DOWNLOAD_POLICY.enabled

  const delayUnit: DownloadDelayUnit = VALID_UNITS.includes(
    obj.delayUnit as DownloadDelayUnit
  )
    ? (obj.delayUnit as DownloadDelayUnit)
    : DEFAULT_VIDEO_DOWNLOAD_POLICY.delayUnit

  const maxForUnit = MAX_DOWNLOAD_DELAY_BY_UNIT[delayUnit]
  const parsedVal = Number(obj.delayValue)
  const delayValue = Number.isFinite(parsedVal)
    ? Math.min(maxForUnit, Math.max(0, Math.round(parsedVal)))
    : DEFAULT_VIDEO_DOWNLOAD_POLICY.delayValue

  return {
    enabled,
    delayValue,
    delayUnit,
  }
}

export function sanitizeVideoDownloadOverride(raw: unknown): VideoDownloadOverride {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_VIDEO_DOWNLOAD_OVERRIDE }
  }

  const obj = raw as Record<string, unknown>
  const mode: VideoDownloadOverrideMode = VALID_OVERRIDE_MODES.includes(
    obj.mode as VideoDownloadOverrideMode
  )
    ? (obj.mode as VideoDownloadOverrideMode)
    : "default"

  if (mode === "custom_date") {
    const rawDate = typeof obj.availableAt === "string" ? obj.availableAt.trim() : ""
    const parsed = rawDate ? new Date(rawDate) : null
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return {
        mode: "custom_date",
        availableAt: parsed.toISOString(),
      }
    }
    return { ...DEFAULT_VIDEO_DOWNLOAD_OVERRIDE }
  }

  return {
    mode,
    availableAt: null,
  }
}

export function addDelayToDate(
  baseDate: Date,
  delayValue: number,
  delayUnit: DownloadDelayUnit
): Date {
  const safeValue = Math.max(0, Math.round(delayValue))
  if (safeValue === 0) {
    return new Date(baseDate.getTime())
  }

  if (delayUnit === "days") {
    return new Date(baseDate.getTime() + safeValue * 24 * 60 * 60 * 1000)
  }

  if (delayUnit === "weeks") {
    return new Date(baseDate.getTime() + safeValue * 7 * 24 * 60 * 60 * 1000)
  }

  // Calendar-safe month addition (clamps day-of-month if target month has fewer days)
  const result = new Date(baseDate.getTime())
  const originalDay = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + safeValue)
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate()
  result.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth))
  return result
}

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function evaluateVideoDownloadAvailability(params: {
  releaseDate?: Date | string | null
  publishedAt?: Date | string | null
  createdAt?: Date | string | null
  policy?: VideoDownloadPolicy | null
  override?: VideoDownloadOverride | null
  now?: Date | number
}): VideoDownloadAvailability {
  const nowDate =
    params.now instanceof Date
      ? params.now
      : typeof params.now === "number"
        ? new Date(params.now)
        : new Date()
  const nowMs = nowDate.getTime()

  const baseDate =
    toValidDate(params.releaseDate) ??
    toValidDate(params.publishedAt) ??
    toValidDate(params.createdAt) ??
    nowDate

  const override = params.override
    ? sanitizeVideoDownloadOverride(params.override)
    : DEFAULT_VIDEO_DOWNLOAD_OVERRIDE

  if (override.mode === "disabled") {
    return {
      isAvailable: false,
      reason: "DISABLED",
      availableAt: null,
      daysRemaining: 0,
      baseDate,
    }
  }

  if (override.mode === "immediate") {
    return {
      isAvailable: true,
      reason: "AVAILABLE",
      availableAt: null,
      daysRemaining: 0,
      baseDate,
    }
  }

  if (override.mode === "custom_date" && override.availableAt) {
    const targetDate = toValidDate(override.availableAt)
    if (targetDate) {
      const remainingMs = targetDate.getTime() - nowMs
      if (remainingMs > 0) {
        return {
          isAvailable: false,
          reason: "LOCKED_BY_CUSTOM_DATE",
          availableAt: targetDate,
          daysRemaining: Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
          baseDate,
        }
      }
      return {
        isAvailable: true,
        reason: "AVAILABLE",
        availableAt: targetDate,
        daysRemaining: 0,
        baseDate,
      }
    }
  }

  const policy = sanitizeVideoDownloadPolicy(params.policy)
  if (!policy.enabled || policy.delayValue <= 0) {
    return {
      isAvailable: true,
      reason: "AVAILABLE",
      availableAt: null,
      daysRemaining: 0,
      baseDate,
    }
  }

  const availableAt = addDelayToDate(baseDate, policy.delayValue, policy.delayUnit)
  const remainingMs = availableAt.getTime() - nowMs

  if (remainingMs > 0) {
    return {
      isAvailable: false,
      reason: "LOCKED_BY_DELAY",
      availableAt,
      daysRemaining: Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))),
      baseDate,
    }
  }

  return {
    isAvailable: true,
    reason: "AVAILABLE",
    availableAt,
    daysRemaining: 0,
    baseDate,
  }
}

export function formatDownloadDelayLabel(
  policy: VideoDownloadPolicy,
  locale: "es" | "en" = "es"
): string {
  const safe = sanitizeVideoDownloadPolicy(policy)
  if (!safe.enabled || safe.delayValue <= 0) {
    return locale === "es" ? "Sin espera (inmediato)" : "Immediate (no delay)"
  }

  const v = safe.delayValue
  if (locale === "es") {
    if (safe.delayUnit === "days") return v === 1 ? "1 día" : `${v} días`
    if (safe.delayUnit === "weeks") return v === 1 ? "1 semana" : `${v} semanas`
    return v === 1 ? "1 mes" : `${v} meses`
  }

  if (safe.delayUnit === "days") return v === 1 ? "1 day" : `${v} days`
  if (safe.delayUnit === "weeks") return v === 1 ? "1 week" : `${v} weeks`
  return v === 1 ? "1 month" : `${v} months`
}

export function formatDownloadUnlockDate(
  date: Date | string,
  locale: "es" | "en" = "en"
): string {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}
