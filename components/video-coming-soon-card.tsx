"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Calendar, Check, Loader2 } from "lucide-react"
import { useCountdown } from "@/components/coming-soon-card"
import { useAuthModal } from "@/components/auth/auth-modal-provider"
import { safeParseJson } from "@/lib/safe-json"

interface Performer {
  name: string
  slug: string
}

interface VideoComingSoonCardProps {
  videoId?: string
  slug: string
  title: string
  imageUrl?: string | null
  releaseDate?: string | null
  category?: string
  performers?: Performer[]
  variant?: "overlay" | "below"
  onExpire?: () => void
}

function formatScheduledDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ]
  const day = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} de ${month} de ${year}`
}

export function VideoComingSoonCard({
  videoId,
  slug,
  title,
  imageUrl,
  releaseDate,
  category,
  performers = [],
  variant = "overlay",
  onExpire,
}: VideoComingSoonCardProps) {
  const router = useRouter()
  const timeLeft = useCountdown(releaseDate, onExpire)
  const { openAuthModal } = useAuthModal()
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [justToggled, setJustToggled] = useState(false)

  const notifyIdentifier = videoId || slug
  const pad = (n: number) => n.toString().padStart(2, "0")

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    router.push(`/videos/${slug}`)
  }

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      router.push(`/videos/${slug}`)
    }
  }

  useEffect(() => {
    if (!notifyIdentifier) return
    let active = true
    fetch(`/api/videos/${encodeURIComponent(notifyIdentifier)}/notify`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? safeParseJson<{ subscribed?: boolean }>(r) : null))
      .then((data) => {
        if (active && data) setSubscribed(Boolean(data.subscribed))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [notifyIdentifier])

  const handleNotify = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!notifyIdentifier) return
    setLoading(true)
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(notifyIdentifier)}/notify`, {
        method: "POST",
        credentials: "include",
      })
      if (res.status === 401) {
        openAuthModal({ view: "login" })
        return
      }
      if (!res.ok) return
      const data = await safeParseJson<{ subscribed?: boolean }>(res)
      if (!data) return
      setSubscribed(Boolean(data.subscribed))
      setJustToggled(true)
      setTimeout(() => setJustToggled(false), 2500)
    } catch {
      // ignore network error
    } finally {
      setLoading(false)
    }
  }

  const performerLine =
    performers.length > 0 ? performers.map((p) => p.name).join(" & ") : null
  const labelText = category ? `COMING SOON · ${category.toUpperCase()}` : "COMING SOON"
  const cardHeadline = performerLine || title
  const scheduledDateText = formatScheduledDate(releaseDate)

  const mediaFrame = (
    <div
      className="relative w-full aspect-[476/309] overflow-hidden select-none bg-zinc-950"
      style={{ containerType: "inline-size" }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover object-left brightness-[0.3] transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <span
            className="font-bold text-zinc-700"
            style={{ fontSize: "16cqw" }}
          >
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Cinematic dark scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/35" />

      {/* Centered FOMO overlay matching ComingSoonCard */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center"
        style={{ paddingInline: "5cqw", paddingBlock: "3.5cqw" }}
      >
        {/* Top kicker tag */}
        <div
          className="font-bold tracking-widest uppercase max-w-full truncate"
          style={{
            backgroundColor: "var(--cs-label-bg, #2D3748)",
            color: "var(--cs-label-color, #FFFFFF)",
            padding: "1.3cqw 3.2cqw",
            marginBottom: "2.4cqw",
            fontSize: "clamp(8px, 2.7cqw, 12px)",
            lineHeight: 1.2,
          }}
        >
          {labelText}
        </div>

        {/* Performer / Title highlight block */}
        <div
          className="font-bold text-center max-w-[92%] truncate"
          style={{
            backgroundColor: "var(--cs-name-bg, #2D3748)",
            color: "var(--cs-name-color, #FFFFFF)",
            padding: "1.6cqw 3.8cqw",
            marginBottom: "3.4cqw",
            fontSize: "clamp(11px, 4.1cqw, 19px)",
            lineHeight: 1.2,
          }}
        >
          {cardHeadline}
        </div>

        {/* Tabular D / H / M / S Countdown */}
        <div
          className="flex items-start justify-center"
          style={{ gap: "4cqw", marginBottom: "3.8cqw" }}
        >
          {[
            { value: timeLeft.days, label: "D" },
            { value: timeLeft.hours, label: "H" },
            { value: timeLeft.minutes, label: "M" },
            { value: timeLeft.seconds, label: "S" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center">
              <span
                className="font-bold tabular-nums leading-none"
                style={{
                  color: "var(--cs-number-color, #FFFFFF)",
                  fontSize: "clamp(15px, 6.8cqw, 32px)",
                }}
              >
                {pad(item.value)}
              </span>
              <span
                className="font-semibold leading-none"
                style={{
                  color: "var(--cs-letter-color, #9CA3AF)",
                  fontSize: "clamp(8px, 2.6cqw, 12px)",
                  marginTop: "1cqw",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Notify Me CTA */}
        <button
          type="button"
          onClick={handleNotify}
          disabled={loading}
          className="flex items-center justify-center font-bold tracking-wide uppercase transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
          style={{
            gap: "1.8cqw",
            padding: "2.2cqw 5.2cqw",
            fontSize: "clamp(9.5px, 3cqw, 14px)",
            lineHeight: 1.1,
            backgroundColor: subscribed
              ? "var(--brand-color, #40E0D0)"
              : "var(--cs-button-bg, #F4A0AB)",
            color: "var(--cs-button-color, #FFFFFF)",
            boxShadow: subscribed ? "0 0 18px rgba(64, 224, 208, 0.28)" : "none",
          }}
        >
          {loading ? (
            <Loader2
              className="animate-spin flex-shrink-0"
              style={{
                width: "clamp(11px, 3.3cqw, 16px)",
                height: "clamp(11px, 3.3cqw, 16px)",
              }}
            />
          ) : subscribed ? (
            <Check
              className="flex-shrink-0"
              style={{
                width: "clamp(11px, 3.3cqw, 16px)",
                height: "clamp(11px, 3.3cqw, 16px)",
              }}
            />
          ) : (
            <Bell
              className="flex-shrink-0"
              style={{
                width: "clamp(11px, 3.3cqw, 16px)",
                height: "clamp(11px, 3.3cqw, 16px)",
              }}
            />
          )}
          <span>{loading ? "..." : subscribed ? "Subscribed" : "Notify Me"}</span>
        </button>

        {/* Inline toggle toast */}
        {justToggled && (
          <div
            className="font-medium max-w-full truncate"
            style={{
              marginTop: "2.2cqw",
              padding: "1.2cqw 3cqw",
              fontSize: "clamp(9px, 2.5cqw, 12px)",
              lineHeight: 1.2,
              backgroundColor: subscribed
                ? "rgba(64, 224, 208, 0.16)"
                : "rgba(255,255,255,0.1)",
              color: subscribed
                ? "var(--brand-color, #40E0D0)"
                : "var(--cs-letter-color, #9CA3AF)",
              border: subscribed
                ? "1px solid rgba(64, 224, 208, 0.35)"
                : "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {subscribed ? "You'll be notified when this scene drops!" : "Notification removed"}
          </div>
        )}
      </div>
    </div>
  )

  if (variant === "below") {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className="group block cursor-pointer"
      >
        <div className="mb-3">{mediaFrame}</div>
        <div className="flex flex-col">
          <h3
            className="font-bold text-lg leading-tight mb-1 line-clamp-1"
            style={{ color: "var(--vc-title-color)" }}
          >
            {title}
          </h3>
          <div
            className="flex items-center gap-3 text-sm"
            style={{ color: "var(--vc-meta-color)" }}
          >
            <span
              className="font-semibold uppercase tracking-wider text-xs"
              style={{ color: "var(--brand-color, #FA4860)" }}
            >
              Coming Soon
            </span>
            {scheduledDateText && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{scheduledDateText}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      className="group block cursor-pointer overflow-hidden"
    >
      {mediaFrame}
    </div>
  )
}
