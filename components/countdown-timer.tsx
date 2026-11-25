"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Bell, BellRing, Check, Loader2, Play, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { BannerKicker } from "@/components/banner-kicker"
import {
  BannerContentPosition,
  hexToRgba,
  parseTargetDateToIso,
  sanitizeBannerUrl,
} from "@/lib/banner-utils"
import type {
  ResolvedUpcomingScene,
  UpcomingScenePhase,
  UpcomingSceneSlide,
} from "@/lib/upcoming-scene"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

interface CountdownTimerProps {
  /** Resolved Upcoming Scene payload from server (Auto or Manual state machine) */
  resolved?: ResolvedUpcomingScene
  /** Legacy fallback props (still supported if rendered standalone) */
  targetDate?: string
  kicker?: string
  title?: string
  subtitle?: string
  backgroundImage?: string
  videoUrl?: string
  height?: number
  contentPosition?: BannerContentPosition
  overlayEnabled?: boolean
  overlayOpacity?: number
  overlayColor?: string
  blurEnabled?: boolean
  blurIntensity?: number
  titleFontFamily?: string
  titleFontSize?: number
  buttonBgColor?: string
  buttonHoverColor?: string
  buttonTextColor?: string
  buttonHoverTextColor?: string
}

function computeTimeLeft(targetIso: string | null | undefined): TimeLeft {
  if (!targetIso) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }
  const targetMs = new Date(targetIso).getTime()
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }
  const diff = targetMs - Date.now()
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    totalMs: diff,
  }
}

export function CountdownTimer({
  resolved,
  targetDate: targetDateProp,
  kicker: kickerProp,
  title: titleProp = "NEXT RELEASE",
  subtitle: subtitleProp = "",
  backgroundImage: bgImageProp = "/images/background.png",
  videoUrl: videoUrlProp,
  height = 540,
  contentPosition = "center",
  overlayEnabled = true,
  overlayOpacity = 0.58,
  overlayColor = "#000000",
  blurEnabled,
  blurIntensity = 6,
  titleFontFamily,
  titleFontSize,
  buttonBgColor,
  buttonHoverColor,
  buttonTextColor,
  buttonHoverTextColor,
}: CountdownTimerProps) {
  const router = useRouter()

  // Build normalized scene descriptor whether passed `resolved` or legacy props
  const scene: ResolvedUpcomingScene = resolved ?? (() => {
    const iso = parseTargetDateToIso(targetDateProp)
    const isFuture = iso ? new Date(iso).getTime() > Date.now() : false
    const fallbackSlide: UpcomingSceneSlide = {
      kicker: kickerProp || "UPCOMING SCENE",
      title: titleProp,
      subtitle: subtitleProp,
      backgroundImage: bgImageProp,
      videoUrl: videoUrlProp,
      targetDateIso: iso,
    }
    return {
      mode: "manual",
      initialPhase: isFuture ? "countdown" : "new_release",
      stateA: fallbackSlide,
      stateB: {
        ...fallbackSlide,
        kicker: "NEW SCENE | OUT NOW",
        buttonText: "WATCH NOW",
        buttonUrl: "/videos",
      },
      stateC: null,
      targetDateIso: iso,
      stateBEndsAtIso: null,
      manualStateCAction: "keep_b",
      triggerVideoReleaseOnEnd: false,
    }
  })()

  // In Auto mode, enable subtle cinematic blur by default if not explicitly toggled off
  const effectiveBlurEnabled = blurEnabled ?? (scene.mode === "auto")

  const [phase, setPhase] = useState<UpcomingScenePhase>(scene.initialPhase)
  const [isButtonHovered, setIsButtonHovered] = useState(false)
  const [notifySubscribed, setNotifySubscribed] = useState(false)
  const [notifyLoading, setNotifyLoading] = useState(false)
  const releaseTriggeredRef = useRef(false)
  const expiryRefreshedRef = useRef(false)

  // Determine the active slide for the current phase
  const activeSlide: UpcomingSceneSlide =
    phase === "countdown"
      ? scene.stateA
      : phase === "new_release"
        ? scene.stateB
        : scene.stateC || scene.stateB

  // Support optional chained countdown inside Manual State C ("custom" with stateCTargetDate)
  const activeCountdownTargetIso =
    phase === "countdown"
      ? scene.targetDateIso
      : phase === "fallback" && activeSlide.targetDateIso
        ? activeSlide.targetDateIso
        : null

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    computeTimeLeft(activeCountdownTargetIso)
  )

  const showClock =
    phase === "countdown" ||
    (phase === "fallback" &&
      Boolean(activeSlide.targetDateIso) &&
      timeLeft.totalMs > 0)

  // Sync phase if server refreshes props
  useEffect(() => {
    setPhase(scene.initialPhase)
    releaseTriggeredRef.current = false
    expiryRefreshedRef.current = false
  }, [scene.initialPhase, scene.targetDateIso, scene.stateBEndsAtIso])

  // Check initial Notify Me status when a DB video is in countdown phase
  const notifyVideoKey =
    activeSlide.enableNotifyMe && (activeSlide.videoId || activeSlide.videoSlug)
      ? activeSlide.videoId || activeSlide.videoSlug
      : null

  useEffect(() => {
    if (!notifyVideoKey) {
      setNotifySubscribed(false)
      return
    }
    let cancelled = false
    fetch(`/api/videos/${encodeURIComponent(notifyVideoKey)}/notify`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.subscribed === "boolean") {
          setNotifySubscribed(data.subscribed)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [notifyVideoKey])

  // Live 1-second state machine & timer
  useEffect(() => {
    const tick = () => {
      const nowMs = Date.now()

      if (phase === "countdown" && scene.targetDateIso) {
        const next = computeTimeLeft(scene.targetDateIso)
        setTimeLeft(next)

        if (next.totalMs <= 0) {
          setPhase("new_release")

          if (scene.triggerVideoReleaseOnEnd && !releaseTriggeredRef.current) {
            releaseTriggeredRef.current = true
            fetch("/api/videos/release", { method: "POST" })
              .catch(() => {})
              .finally(() => {
                router.refresh()
              })
          }
        }
        return
      }

      if (phase === "new_release" && scene.stateBEndsAtIso) {
        const endMs = new Date(scene.stateBEndsAtIso).getTime()
        if (!Number.isNaN(endMs) && nowMs >= endMs) {
          if (scene.manualStateCAction !== "keep_b") {
            setPhase("fallback")
            if (
              (scene.mode === "auto" || scene.manualStateCAction === "auto") &&
              !expiryRefreshedRef.current
            ) {
              expiryRefreshedRef.current = true
              router.refresh()
            }
          }
        }
        return
      }

      if (phase === "fallback" && activeSlide.targetDateIso) {
        setTimeLeft(computeTimeLeft(activeSlide.targetDateIso))
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [
    phase,
    scene.targetDateIso,
    scene.stateBEndsAtIso,
    scene.triggerVideoReleaseOnEnd,
    scene.manualStateCAction,
    scene.mode,
    activeSlide.targetDateIso,
    router,
  ])

  const handleToggleNotify = useCallback(async () => {
    if (!notifyVideoKey || notifyLoading) return

    setNotifyLoading(true)
    try {
      const res = await fetch(
        `/api/videos/${encodeURIComponent(notifyVideoKey)}/notify`,
        { method: "POST" }
      )

      if (res.status === 401) {
        toast.info("Sign in to receive a notification when this scene drops")
        router.push("/?login=true")
        return
      }

      if (!res.ok) {
        toast.error("Could not update notification preference")
        return
      }

      const data = await res.json()
      const subscribed = Boolean(data.subscribed)
      setNotifySubscribed(subscribed)
      if (subscribed) {
        toast.success("We'll notify you as soon as this scene goes live")
      } else {
        toast.info("Notification reminder removed")
      }
    } catch {
      toast.error("Connection error. Please try again.")
    } finally {
      setNotifyLoading(false)
    }
  }, [notifyVideoKey, notifyLoading, router])

  const formatNumber = (num: number) => num.toString().padStart(2, "0")

  const blurStyle = effectiveBlurEnabled
    ? { filter: `blur(${blurIntensity}px)`, transform: "scale(1.1)" }
    : undefined

  const positionMap: Record<
    BannerContentPosition,
    { items: string; justify: string; text: string; align: "left" | "center" | "right" }
  > = {
    "top-left": { items: "items-start", justify: "justify-start", text: "text-left", align: "left" },
    "top-center": { items: "items-center", justify: "justify-start", text: "text-center", align: "center" },
    "top-right": { items: "items-end", justify: "justify-start", text: "text-right", align: "right" },
    "center-left": { items: "items-start", justify: "justify-center", text: "text-left", align: "left" },
    "center": { items: "items-center", justify: "justify-center", text: "text-center", align: "center" },
    "center-right": { items: "items-end", justify: "justify-center", text: "text-right", align: "right" },
    "bottom-left": { items: "items-start", justify: "justify-end", text: "text-left", align: "left" },
    "bottom-center": { items: "items-center", justify: "justify-end", text: "text-center", align: "center" },
    "bottom-right": { items: "items-end", justify: "justify-end", text: "text-right", align: "right" },
  }
  const pos = positionMap[contentPosition] || positionMap.center

  const safeCtaUrl = sanitizeBannerUrl(activeSlide.buttonUrl)
  const resolvedBgVideo = activeSlide.videoUrl?.trim() || undefined
  const resolvedBgImage = activeSlide.backgroundImage?.trim() || "/images/background.png"

  const ctaButtonStyle = {
    backgroundColor: isButtonHovered
      ? buttonHoverColor || buttonBgColor || "var(--brand-color-hover, #e03e54)"
      : buttonBgColor || "var(--brand-color, #FA4860)",
    color: isButtonHovered
      ? buttonHoverTextColor || buttonTextColor || "#FFFFFF"
      : buttonTextColor || "#FFFFFF",
    fontFamily: "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
  }

  const headlineFontSize = titleFontSize
    ? `clamp(2.1rem, 5.5vw, ${titleFontSize}px)`
    : "clamp(2.35rem, 6.2vw, 4.75rem)"

  const showWatchAction = !showClock && Boolean(activeSlide.buttonText)
  const showManualCountdownCta =
    showClock && !activeSlide.enableNotifyMe && Boolean(activeSlide.buttonText)

  return (
    <section
      className="relative w-full overflow-hidden bg-black"
      style={{ minHeight: `${height}px` }}
    >
      {/* Background Video or Image */}
      <div className="absolute inset-0">
        {resolvedBgVideo ? (
          <video
            key={resolvedBgVideo}
            src={resolvedBgVideo}
            poster={resolvedBgImage}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={blurStyle}
          />
        ) : resolvedBgImage ? (
          <img
            src={resolvedBgImage}
            alt={activeSlide.title || "Upcoming scene background"}
            className="w-full h-full object-cover"
            style={blurStyle}
          />
        ) : null}

        {/* Configurable color overlay */}
        {overlayEnabled && (
          <div
            className="absolute inset-0"
            style={{ backgroundColor: hexToRgba(overlayColor, overlayOpacity) }}
          />
        )}

        {/* Cinematic vignette scrim for crisp editorial contrast */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/45 pointer-events-none"
        />
      </div>

      {/* Foreground Content */}
      <div
        className={`relative z-10 flex flex-col ${pos.justify} ${pos.items} w-full max-w-6xl mx-auto px-6 sm:px-10 py-14 sm:py-16`}
        style={{ minHeight: `${height}px` }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${activeSlide.title}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`flex flex-col ${pos.items} ${pos.text} w-full max-w-4xl`}
          >
            {/* Editorial Kicker (e.g., NEW SCENE | CATEGORY) */}
            {activeSlide.kicker && (
              <BannerKicker
                text={activeSlide.kicker}
                align={pos.align}
                className="mb-3 sm:mb-4"
              />
            )}

            {/* Monumental Display Headline (Performer Name / Banner Title) */}
            <h2
              className="font-black uppercase tracking-[-0.02em] leading-[1.02] [text-wrap:balance] drop-shadow-[0_6px_28px_rgba(0,0,0,0.65)]"
              style={{
                color: "var(--cd-title-color, #FFFFFF)",
                fontSize: headlineFontSize,
                fontFamily:
                  titleFontFamily ||
                  "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
              }}
            >
              {activeSlide.title}
            </h2>

            {/* Supporting Scene Subtitle */}
            {activeSlide.subtitle && (
              <p
                className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg font-medium tracking-[0.04em] max-w-2xl leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
                style={{
                  color: "var(--cd-subtitle-color, rgba(255,255,255,0.88))",
                  fontFamily:
                    "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
                }}
              >
                {activeSlide.subtitle}
              </p>
            )}

            {/* State A: Giant Tabular Countdown Clock */}
            {showClock && (
              <div
                className="mt-8 sm:mt-10 flex items-start gap-3 sm:gap-6 md:gap-8"
                aria-label="Release countdown"
              >
                {[
                  { value: timeLeft.days, label: "Days" },
                  { value: timeLeft.hours, label: "Hours" },
                  { value: timeLeft.minutes, label: "Minutes" },
                  { value: timeLeft.seconds, label: "Seconds" },
                ].map((item, idx) => (
                  <div key={item.label} className="flex items-start gap-3 sm:gap-6 md:gap-8">
                    <div className="flex flex-col items-center min-w-[54px] sm:min-w-[82px]">
                      <span
                        className="font-black tabular-nums leading-none tracking-[-0.03em] drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)]"
                        style={{
                          color: "var(--cd-number-color, #FFFFFF)",
                          fontSize: "clamp(2.25rem, 5.4vw, 4.25rem)",
                          fontFamily:
                            "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
                        }}
                      >
                        {formatNumber(item.value)}
                      </span>
                      <span
                        className="mt-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.24em]"
                        style={{
                          color: "var(--cd-label-color, rgba(255,255,255,0.68))",
                          fontFamily:
                            "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                    {idx < 3 && (
                      <span
                        aria-hidden="true"
                        className="font-light text-white/30 select-none leading-none pt-1"
                        style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)" }}
                      >
                        :
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* State A (Auto Video): Interactive Notify Me CTA */}
            {showClock && activeSlide.enableNotifyMe && notifyVideoKey && (
              <div className="mt-8 sm:mt-10">
                <button
                  type="button"
                  onClick={handleToggleNotify}
                  disabled={notifyLoading}
                  onMouseEnter={() => setIsButtonHovered(true)}
                  onMouseLeave={() => setIsButtonHovered(false)}
                  className="inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] transition-all duration-200 cursor-pointer disabled:opacity-60"
                  style={
                    notifySubscribed
                      ? {
                          backgroundColor: "rgba(255,255,255,0.12)",
                          color: "#FFFFFF",
                          border: "1px solid rgba(255,255,255,0.45)",
                          fontFamily:
                            "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
                        }
                      : ctaButtonStyle
                  }
                >
                  {notifyLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : notifySubscribed ? (
                    <Check className="size-4" />
                  ) : isButtonHovered ? (
                    <BellRing className="size-4" />
                  ) : (
                    <Bell className="size-4" />
                  )}
                  <span>
                    {notifySubscribed
                      ? activeSlide.notifiedButtonText || "NOTIFIED"
                      : activeSlide.notifyButtonText || "NOTIFY ME"}
                  </span>
                </button>
              </div>
            )}

            {/* State A (Manual): Optional Custom Button */}
            {showManualCountdownCta && (
              <div className="mt-8 sm:mt-10">
                {safeCtaUrl ? (
                  <Link
                    href={safeCtaUrl}
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    className="inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] transition-all duration-200"
                    style={ctaButtonStyle}
                  >
                    <span>{activeSlide.buttonText}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                ) : (
                  <span
                    className="inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em]"
                    style={ctaButtonStyle}
                  >
                    {activeSlide.buttonText}
                  </span>
                )}
              </div>
            )}

            {/* State B / State C: High-Impact WATCH NOW / CTA Button */}
            {showWatchAction && (
              <div className="mt-8 sm:mt-10">
                {safeCtaUrl ? (
                  <Link
                    href={safeCtaUrl}
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    className="inline-flex items-center justify-center gap-3 px-9 sm:px-11 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.22em] transition-all duration-200 shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
                    style={ctaButtonStyle}
                  >
                    <Play className="size-4 fill-current" />
                    <span>{activeSlide.buttonText}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onMouseEnter={() => setIsButtonHovered(true)}
                    onMouseLeave={() => setIsButtonHovered(false)}
                    className="inline-flex items-center justify-center gap-3 px-9 sm:px-11 py-4 text-xs sm:text-sm font-extrabold uppercase tracking-[0.22em] transition-all duration-200"
                    style={ctaButtonStyle}
                  >
                    <Play className="size-4 fill-current" />
                    <span>{activeSlide.buttonText}</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
