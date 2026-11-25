"use client"

import React, { useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Clock, LogOut, ShieldAlert, ShieldCheck, X } from "lucide-react"
import { useSessionTimeout } from "@/components/auth/session-timeout-provider"
import { useAuthModal } from "@/components/auth/auth-modal-provider"
import {
  SESSION_WARNING_WINDOW_SECONDS,
  formatTimeoutDuration,
  formatWarningCountdown,
} from "@/lib/session-timeout"

export function SessionTimeoutModal() {
  const { status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { openAuthModal } = useAuthModal()
  const {
    sessionTimeoutMinutes,
    sessionWarningSecondsLeft,
    sessionExpiredByInactivity,
    dismissSessionExpiredNotice,
    extendSession,
    logoutNow,
  } = useSessionTimeout()

  const isAdminRoute = pathname?.startsWith("/admin") ?? false
  const locale: "es" | "en" = isAdminRoute ? "es" : "en"

  const showWarning =
    status === "authenticated" && sessionWarningSecondsLeft !== null
  const showExpiredNotice =
    status === "unauthenticated" && sessionExpiredByInactivity

  // Allow Escape to dismiss only the post-expiration notice (not the active security warning)
  useEffect(() => {
    if (!showExpiredNotice) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismissSessionExpiredNotice()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [showExpiredNotice, dismissSessionExpiredNotice])

  const handleLoginAgain = () => {
    dismissSessionExpiredNotice()
    if (isAdminRoute) {
      if (pathname !== "/admin/login") {
        router.push("/admin/login")
      }
    } else {
      openAuthModal({ view: "login" })
    }
  }

  const warningWindowSeconds = Math.min(
    SESSION_WARNING_WINDOW_SECONDS,
    Math.floor((sessionTimeoutMinutes * 60) * 0.25)
  )
  const progressPercent =
    sessionWarningSecondsLeft !== null && warningWindowSeconds > 0
      ? Math.max(0, Math.min(100, (sessionWarningSecondsLeft / warningWindowSeconds) * 100))
      : 0

  const copy =
    locale === "es"
      ? {
          warningEyebrow: "CONTROL DE SEGURIDAD",
          warningTitle: "¿Sigues ahí?",
          warningSubtitle: "Tu sesión se cerrará por inactividad en",
          warningBody:
            "Por seguridad, cerramos automáticamente las sesiones sin actividad. Haz clic en el botón inferior para continuar trabajando sin interrupciones.",
          keepActive: "Mantener sesión activa",
          logoutNow: "Cerrar sesión ahora",
          expiredEyebrow: "SESIÓN FINALIZADA",
          expiredTitle: "Sesión cerrada por inactividad",
          expiredSubtitle: "Protección automática de cuenta",
          expiredBodyPrefix: "Por seguridad, tu sesión se ha cerrado automáticamente tras ",
          expiredBodySuffix:
            " sin actividad. Inicia sesión de nuevo para continuar con tu cuenta.",
          loginAgain: "Iniciar sesión de nuevo",
          continueBrowsing: "Seguir navegando",
          closeLabel: "Cerrar aviso",
        }
      : {
          warningEyebrow: "SECURITY NOTICE",
          warningTitle: "Still there?",
          warningSubtitle: "Your session will close due to inactivity in",
          warningBody:
            "For your security, inactive sessions are signed out automatically. Click below to stay signed in without interruption.",
          keepActive: "Keep Session Active",
          logoutNow: "Log Out Now",
          expiredEyebrow: "SESSION ENDED",
          expiredTitle: "Session Closed Due to Inactivity",
          expiredSubtitle: "Automatic account protection",
          expiredBodyPrefix: "For your security, your session was automatically closed after ",
          expiredBodySuffix: " of inactivity. Sign in again to continue using your account.",
          loginAgain: "Log In Again",
          continueBrowsing: "Continue Browsing",
          closeLabel: "Close notice",
        }

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          key="session-warning-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-warning-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md border border-white/15 bg-[#0B0B0D] text-white shadow-2xl overflow-hidden"
          >
            {/* Top accent bar */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: "var(--brand-color, #FA4860)" }}
            />

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 shrink-0 border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-400/90">
                    {copy.warningEyebrow}
                  </p>
                  <h2
                    id="session-warning-title"
                    className="text-xl font-bold tracking-tight text-white mt-0.5"
                  >
                    {copy.warningTitle}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">{copy.warningSubtitle}</p>
                </div>
              </div>

              {/* Countdown panel */}
              <div className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <div className="flex items-center justify-center">
                  <span
                    className="text-4xl font-mono font-bold tracking-wider tabular-nums"
                    style={{ color: "var(--brand-color, #FA4860)" }}
                  >
                    {formatWarningCountdown(sessionWarningSecondsLeft)}
                  </span>
                </div>
                <div className="mt-3 h-1 w-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: "var(--brand-color, #FA4860)",
                    }}
                  />
                </div>
              </div>

              <p className="text-sm text-zinc-300 leading-relaxed">{copy.warningBody}</p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={extendSession}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: "var(--brand-color, #FA4860)" }}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{copy.keepActive}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void logoutNow()
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>{copy.logoutNow}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {!showWarning && showExpiredNotice && (
        <motion.div
          key="session-expired-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-expired-title"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md border border-white/15 bg-[#0B0B0D] text-white shadow-2xl overflow-hidden"
          >
            {/* Top accent bar */}
            <div
              className="h-1 w-full"
              style={{ backgroundColor: "var(--brand-color, #FA4860)" }}
            />

            <div className="p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 shrink-0 border flex items-center justify-center"
                    style={{
                      borderColor: "color-mix(in srgb, var(--brand-color, #FA4860) 40%, transparent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--brand-color, #FA4860) 12%, transparent)",
                      color: "var(--brand-color, #FA4860)",
                    }}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold tracking-[0.18em] uppercase"
                      style={{ color: "var(--brand-color, #FA4860)" }}
                    >
                      {copy.expiredEyebrow}
                    </p>
                    <h2
                      id="session-expired-title"
                      className="text-xl font-bold tracking-tight text-white mt-0.5"
                    >
                      {copy.expiredTitle}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">{copy.expiredSubtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissSessionExpiredNotice}
                  aria-label={copy.closeLabel}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Explanation */}
              <p className="text-sm text-zinc-300 leading-relaxed">
                {copy.expiredBodyPrefix}
                <span className="font-semibold text-white">
                  {formatTimeoutDuration(sessionTimeoutMinutes, locale)}
                </span>
                {copy.expiredBodySuffix}
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleLoginAgain}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: "var(--brand-color, #FA4860)" }}
                >
                  <span>{copy.loginAgain}</span>
                </button>
                <button
                  type="button"
                  onClick={dismissSessionExpiredNotice}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border border-white/15 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.1] hover:text-white transition-colors cursor-pointer"
                >
                  <span>{copy.continueBrowsing}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
