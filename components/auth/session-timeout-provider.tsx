"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { useSession, signOut } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  SESSION_STORAGE_KEYS,
  SESSION_WARNING_WINDOW_SECONDS,
  clampSessionTimeoutMinutes,
  clearStoredSessionActivity,
  isSessionExpiredByInactivity,
  markSessionExpiredNotice,
  readCachedTimeoutMinutes,
  readSessionExpiredNotice,
  readStoredLastActivity,
  writeCachedTimeoutMinutes,
  writeStoredLastActivity,
} from "@/lib/session-timeout"

interface SessionTimeoutContextValue {
  sessionTimeoutMinutes: number
  isPolicyLoaded: boolean
  updateSessionTimeoutMinutes: (minutes: number) => Promise<number>
  sessionWarningSecondsLeft: number | null
  sessionExpiredByInactivity: boolean
  dismissSessionExpiredNotice: () => void
  extendSession: () => void
  logoutNow: () => Promise<void>
}

const SessionTimeoutContext = createContext<SessionTimeoutContextValue | null>(null)

const ACTIVITY_WRITE_THROTTLE_MS = 2000
const POLICY_REFETCH_THROTTLE_MS = 60_000

const USER_ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
  "click",
]

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const userId = session?.user?.id ?? null
  const signedInAt = session?.user?.signedInAt ?? null
  const isAuthenticated = status === "authenticated" && Boolean(userId)

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(
    DEFAULT_SESSION_TIMEOUT_MINUTES
  )
  const [isPolicyLoaded, setIsPolicyLoaded] = useState(false)
  const [sessionWarningSecondsLeft, setSessionWarningSecondsLeft] = useState<number | null>(null)
  const [sessionExpiredByInactivity, setSessionExpiredByInactivity] = useState<boolean>(false)

  const sessionTimeoutMinutesRef = useRef<number>(DEFAULT_SESSION_TIMEOUT_MINUTES)
  const lastActivityRef = useRef<number>(Date.now())
  const lastStorageWriteRef = useRef<number>(0)
  const lastPolicyFetchRef = useRef<number>(0)
  const warningActiveRef = useRef<boolean>(false)
  const isLoggingOutRef = useRef<boolean>(false)
  const pathnameRef = useRef<string>(pathname || "/")

  useEffect(() => {
    pathnameRef.current = pathname || "/"
  }, [pathname])

  useEffect(() => {
    sessionTimeoutMinutesRef.current = sessionTimeoutMinutes
  }, [sessionTimeoutMinutes])

  const fetchPolicyFromServer = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastPolicyFetchRef.current < POLICY_REFETCH_THROTTLE_MS) {
      return
    }
    lastPolicyFetchRef.current = now

    try {
      const response = await fetch("/api/settings/session-timeout", {
        method: "GET",
        cache: "no-store",
      })
      if (!response.ok) return
      const data = await response.json()
      const clamped = clampSessionTimeoutMinutes(data?.sessionTimeoutMinutes)
      sessionTimeoutMinutesRef.current = clamped
      setSessionTimeoutMinutes(clamped)
      writeCachedTimeoutMinutes(clamped)
    } catch {
      // Keep cached/default timeout if offline or transient error
    } finally {
      setIsPolicyLoaded(true)
    }
  }, [])

  // Initial client-side hydration of cached timeout & expired notice, plus live server policy fetch
  useEffect(() => {
    const cached = readCachedTimeoutMinutes()
    sessionTimeoutMinutesRef.current = cached
    setSessionTimeoutMinutes(cached)

    if (readSessionExpiredNotice()) {
      setSessionExpiredByInactivity(true)
    }

    fetchPolicyFromServer(true)
  }, [fetchPolicyFromServer])

  const dismissSessionExpiredNotice = useCallback(() => {
    markSessionExpiredNotice(null)
    setSessionExpiredByInactivity(false)
  }, [])

  const performInactivityLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return
    isLoggingOutRef.current = true
    warningActiveRef.current = false
    setSessionWarningSecondsLeft(null)

    clearStoredSessionActivity()
    markSessionExpiredNotice("inactivity")
    setSessionExpiredByInactivity(true)

    try {
      await signOut({ redirect: false })
    } catch (error) {
      console.error("Error signing out on inactivity:", error)
    }

    const currentPath = pathnameRef.current
    if (currentPath.startsWith("/admin") && currentPath !== "/admin/login") {
      router.replace("/admin/login")
    }
    router.refresh()
  }, [router])

  const extendSession = useCallback(() => {
    if (!userId) return
    const now = Date.now()
    lastActivityRef.current = now
    lastStorageWriteRef.current = now
    warningActiveRef.current = false
    setSessionWarningSecondsLeft(null)
    markSessionExpiredNotice(null)
    setSessionExpiredByInactivity(false)
    writeStoredLastActivity(userId, now)
  }, [userId])

  const logoutNow = useCallback(async () => {
    warningActiveRef.current = false
    setSessionWarningSecondsLeft(null)
    clearStoredSessionActivity()
    markSessionExpiredNotice(null)
    setSessionExpiredByInactivity(false)

    const currentPath = pathnameRef.current
    const callbackUrl = currentPath.startsWith("/admin") ? "/admin/login" : "/"
    await signOut({ callbackUrl })
  }, [])

  const updateSessionTimeoutMinutes = useCallback(
    async (minutes: number): Promise<number> => {
      const clamped = clampSessionTimeoutMinutes(minutes)
      const response = await fetch("/api/settings/session-timeout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionTimeoutMinutes: clamped }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => null)
        throw new Error(errData?.error || "No se pudo actualizar el tiempo de inactividad")
      }

      const data = await response.json()
      const savedMinutes = clampSessionTimeoutMinutes(data?.sessionTimeoutMinutes ?? clamped)
      sessionTimeoutMinutesRef.current = savedMinutes
      setSessionTimeoutMinutes(savedMinutes)
      writeCachedTimeoutMinutes(savedMinutes)

      // Reset current admin's activity stamp so tightening the timeout never boots them immediately
      if (userId) {
        const now = Date.now()
        lastActivityRef.current = now
        lastStorageWriteRef.current = now
        warningActiveRef.current = false
        setSessionWarningSecondsLeft(null)
        writeStoredLastActivity(userId, now)
      }

      return savedMinutes
    },
    [userId]
  )

  // Listen for cross-tab policy & expired-notice changes even while logged out
  useEffect(() => {
    const handleGlobalStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEYS.TIMEOUT_MINUTES && event.newValue) {
        const updated = clampSessionTimeoutMinutes(event.newValue)
        sessionTimeoutMinutesRef.current = updated
        setSessionTimeoutMinutes(updated)
      }
      if (event.key === SESSION_STORAGE_KEYS.EXPIRED_REASON) {
        setSessionExpiredByInactivity(event.newValue === "inactivity")
      }
    }

    window.addEventListener("storage", handleGlobalStorage)
    return () => window.removeEventListener("storage", handleGlobalStorage)
  }, [])

  // Main inactivity tracker for ALL authenticated users regardless of role
  useEffect(() => {
    if (status === "loading") return

    if (!isAuthenticated || !userId) {
      isLoggingOutRef.current = false
      warningActiveRef.current = false
      setSessionWarningSecondsLeft(null)
      if (readSessionExpiredNotice()) {
        setSessionExpiredByInactivity(true)
      }
      return
    }

    isLoggingOutRef.current = false
    const activeUid = userId
    const nowInit = Date.now()
    const currentTimeoutMinutes = sessionTimeoutMinutesRef.current

    // Immediate wall-clock check when session is restored (e.g. reopened tab / woke device)
    if (
      isSessionExpiredByInactivity(
        activeUid,
        currentTimeoutMinutes,
        nowInit,
        signedInAt
      )
    ) {
      performInactivityLogout()
      return
    }

    // Active valid session: dismiss any prior expired notice and restore/stamp activity
    markSessionExpiredNotice(null)
    setSessionExpiredByInactivity(false)

    const storedActivity = readStoredLastActivity(activeUid)
    const initialActivity = storedActivity ?? nowInit
    lastActivityRef.current = initialActivity
    lastStorageWriteRef.current = nowInit
    if (storedActivity === null) {
      writeStoredLastActivity(activeUid, initialActivity)
    }

    const evaluateInactivity = () => {
      if (isLoggingOutRef.current) return

      const now = Date.now()
      const timeoutMs = clampSessionTimeoutMinutes(sessionTimeoutMinutesRef.current) * 60 * 1000
      const warningWindowMs = Math.min(
        SESSION_WARNING_WINDOW_SECONDS * 1000,
        Math.floor(timeoutMs * 0.25)
      )

      const stored = readStoredLastActivity(activeUid)
      if (stored !== null && stored > lastActivityRef.current) {
        lastActivityRef.current = stored
      }

      const elapsed = now - lastActivityRef.current
      const remaining = timeoutMs - elapsed

      if (remaining <= 0) {
        performInactivityLogout()
        return
      }

      if (remaining <= warningWindowMs) {
        warningActiveRef.current = true
        const secsLeft = Math.max(1, Math.ceil(remaining / 1000))
        setSessionWarningSecondsLeft((prev) => (prev === secsLeft ? prev : secsLeft))
      } else if (warningActiveRef.current) {
        warningActiveRef.current = false
        setSessionWarningSecondsLeft(null)
      }
    }

    const recordActivity = () => {
      // Once the warning modal is visible, require an explicit button click (or activity in another tab)
      if (warningActiveRef.current || isLoggingOutRef.current) return

      const now = Date.now()
      lastActivityRef.current = now
      if (now - lastStorageWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
        lastStorageWriteRef.current = now
        writeStoredLastActivity(activeUid, now)
      }
    }

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return
      // Evaluate elapsed wall-clock time BEFORE recording new activity or refreshing policy
      evaluateInactivity()
      fetchPolicyFromServer(false)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEYS.EXPIRED_REASON && event.newValue === "inactivity") {
        performInactivityLogout()
        return
      }
      if (event.key === SESSION_STORAGE_KEYS.LAST_ACTIVITY_AT && event.newValue) {
        const ts = Number(event.newValue)
        if (Number.isFinite(ts) && ts > lastActivityRef.current) {
          lastActivityRef.current = ts
          if (warningActiveRef.current) {
            warningActiveRef.current = false
            setSessionWarningSecondsLeft(null)
          }
        }
      }
      if (event.key === SESSION_STORAGE_KEYS.TIMEOUT_MINUTES && event.newValue) {
        const updated = clampSessionTimeoutMinutes(event.newValue)
        sessionTimeoutMinutesRef.current = updated
        setSessionTimeoutMinutes(updated)
        evaluateInactivity()
      }
    }

    USER_ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, recordActivity, { passive: true })
    })
    window.addEventListener("focus", handleVisibilityOrFocus)
    document.addEventListener("visibilitychange", handleVisibilityOrFocus)
    window.addEventListener("storage", handleStorage)

    const intervalId = window.setInterval(evaluateInactivity, 1000)
    evaluateInactivity()

    return () => {
      USER_ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, recordActivity)
      })
      window.removeEventListener("focus", handleVisibilityOrFocus)
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus)
      window.removeEventListener("storage", handleStorage)
      window.clearInterval(intervalId)
    }
  }, [
    status,
    isAuthenticated,
    userId,
    signedInAt,
    sessionTimeoutMinutes,
    performInactivityLogout,
    fetchPolicyFromServer,
  ])

  return (
    <SessionTimeoutContext.Provider
      value={{
        sessionTimeoutMinutes,
        isPolicyLoaded,
        updateSessionTimeoutMinutes,
        sessionWarningSecondsLeft,
        sessionExpiredByInactivity,
        dismissSessionExpiredNotice,
        extendSession,
        logoutNow,
      }}
    >
      {children}
    </SessionTimeoutContext.Provider>
  )
}

export function useSessionTimeout() {
  const ctx = useContext(SessionTimeoutContext)
  if (!ctx) {
    throw new Error("useSessionTimeout must be used within <SessionTimeoutProvider>")
  }
  return ctx
}
