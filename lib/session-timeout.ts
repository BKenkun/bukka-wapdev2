export const MIN_SESSION_TIMEOUT_MINUTES = 5
export const MAX_SESSION_TIMEOUT_MINUTES = 480
export const SESSION_WARNING_WINDOW_SECONDS = 60

export const DEFAULT_SESSION_TIMEOUT_MINUTES = (() => {
  const envVal = Number(process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES)
  if (
    Number.isFinite(envVal) &&
    envVal >= MIN_SESSION_TIMEOUT_MINUTES &&
    envVal <= MAX_SESSION_TIMEOUT_MINUTES
  ) {
    return Math.round(envVal)
  }
  return 30
})()

export const SESSION_TIMEOUT_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 5, label: "5 minutos (Alta seguridad)" },
  { minutes: 15, label: "15 minutos" },
  { minutes: 30, label: "30 minutos (Recomendado)" },
  { minutes: 60, label: "1 hora" },
  { minutes: 120, label: "2 horas" },
  { minutes: 240, label: "4 horas" },
]

export const SESSION_STORAGE_KEYS = {
  LAST_ACTIVITY_AT: "bk_session_last_activity",
  ACTIVE_UID: "bk_session_uid",
  TIMEOUT_MINUTES: "bk_session_timeout_minutes",
  EXPIRED_REASON: "bk_session_expired_reason",
} as const

export function clampSessionTimeoutMinutes(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return DEFAULT_SESSION_TIMEOUT_MINUTES
  return Math.min(
    MAX_SESSION_TIMEOUT_MINUTES,
    Math.max(MIN_SESSION_TIMEOUT_MINUTES, Math.round(num))
  )
}

export function readCachedTimeoutMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_SESSION_TIMEOUT_MINUTES
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEYS.TIMEOUT_MINUTES)
    if (!raw) return DEFAULT_SESSION_TIMEOUT_MINUTES
    return clampSessionTimeoutMinutes(raw)
  } catch {
    return DEFAULT_SESSION_TIMEOUT_MINUTES
  }
}

export function writeCachedTimeoutMinutes(minutes: number): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEYS.TIMEOUT_MINUTES,
      String(clampSessionTimeoutMinutes(minutes))
    )
  } catch {
    // Ignore storage quota or private-mode restrictions
  }
}

export function readStoredLastActivity(uid: string): number | null {
  if (typeof window === "undefined" || !uid) return null
  try {
    const storedUid = window.localStorage.getItem(SESSION_STORAGE_KEYS.ACTIVE_UID)
    if (storedUid !== uid) return null
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEYS.LAST_ACTIVITY_AT)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredLastActivity(uid: string, timestamp: number = Date.now()): void {
  if (typeof window === "undefined" || !uid) return
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEYS.ACTIVE_UID, uid)
    window.localStorage.setItem(SESSION_STORAGE_KEYS.LAST_ACTIVITY_AT, String(timestamp))
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredSessionActivity(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEYS.LAST_ACTIVITY_AT)
    window.localStorage.removeItem(SESSION_STORAGE_KEYS.ACTIVE_UID)
  } catch {
    // Ignore storage errors
  }
}

export function markSessionExpiredNotice(reason: "inactivity" | null): void {
  if (typeof window === "undefined") return
  try {
    if (reason) {
      window.localStorage.setItem(SESSION_STORAGE_KEYS.EXPIRED_REASON, reason)
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEYS.EXPIRED_REASON)
    }
  } catch {
    // Ignore storage errors
  }
}

export function readSessionExpiredNotice(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(SESSION_STORAGE_KEYS.EXPIRED_REASON) === "inactivity"
  } catch {
    return false
  }
}

export function isSessionExpiredByInactivity(
  uid: string,
  timeoutMinutes: number,
  now: number = Date.now(),
  fallbackLastSignInTime?: number | string | null
): boolean {
  const timeoutMs = clampSessionTimeoutMinutes(timeoutMinutes) * 60 * 1000
  const lastActivity = readStoredLastActivity(uid)

  if (lastActivity !== null) {
    return now - lastActivity >= timeoutMs
  }

  // Fallback for pre-existing sessions where localStorage has not yet recorded activity
  if (fallbackLastSignInTime !== undefined && fallbackLastSignInTime !== null) {
    const signInMs =
      typeof fallbackLastSignInTime === "number"
        ? fallbackLastSignInTime
        : Date.parse(fallbackLastSignInTime)
    if (Number.isFinite(signInMs) && signInMs > 0) {
      return now - signInMs >= timeoutMs
    }
  }

  return false
}

export function formatTimeoutDuration(minutes: number, locale: "es" | "en" = "en"): string {
  const clamped = clampSessionTimeoutMinutes(minutes)

  if (locale === "es") {
    if (clamped < 60) return `${clamped} minutos`
    const hours = Math.floor(clamped / 60)
    const remainder = clamped % 60
    if (remainder === 0) {
      return hours === 1 ? "1 hora" : `${hours} horas`
    }
    return `${hours} h ${remainder} min`
  }

  if (clamped < 60) return `${clamped} minutes`
  const hours = Math.floor(clamped / 60)
  const remainder = clamped % 60
  if (remainder === 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`
  }
  return `${hours}h ${remainder}m`
}

export function formatWarningCountdown(secondsLeft: number): string {
  const safeSeconds = Math.max(0, Math.ceil(secondsLeft))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  return `${secs}s`
}
