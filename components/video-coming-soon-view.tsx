"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Calendar, Check, Loader2 } from "lucide-react"
import { useAuthModal } from "@/components/auth/auth-modal-provider"

interface VideoComingSoonViewProps {
  video: {
    id: string
    slug: string
    title: string
    description: string | null
    thumbnailUrl: string | null
    releaseDate: string | null
    categoryName: string | null
    performers: Array<{
      id: string
      slug: string
      name: string
    }>
  }
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function VideoComingSoonView({ video }: VideoComingSoonViewProps) {
  const router = useRouter()
  const { openAuthModal } = useAuthModal()
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [formattedRelease, setFormattedRelease] = useState<string | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [justToggled, setJustToggled] = useState(false)
  const unlockedTriggeredRef = useRef(false)

  useEffect(() => {
    let active = true
    fetch(`/api/videos/${encodeURIComponent(video.id)}/notify`)
      .then((r) => r.json())
      .then((data) => {
        if (active) setSubscribed(Boolean(data.subscribed))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [video.id])

  useEffect(() => {
    unlockedTriggeredRef.current = false
    if (!video.releaseDate) {
      setFormattedRelease(null)
      return
    }

    const targetDate = new Date(video.releaseDate)
    const targetMs = targetDate.getTime()
    if (Number.isNaN(targetMs)) return

    try {
      setFormattedRelease(
        targetDate.toLocaleString(undefined, {
          dateStyle: "long",
          timeStyle: "short",
        })
      )
    } catch {
      setFormattedRelease(targetDate.toUTCString())
    }

    const update = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        if (!unlockedTriggeredRef.current) {
          unlockedTriggeredRef.current = true
          fetch("/api/videos/release", { method: "POST" })
            .catch(() => {})
            .finally(() => {
              router.refresh()
            })
        }
        return
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [video.releaseDate, router])

  const handleNotify = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/notify`, {
        method: "POST",
      })
      if (res.status === 401) {
        openAuthModal({ view: "login" })
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setSubscribed(Boolean(data.subscribed))
      setJustToggled(true)
      setTimeout(() => setJustToggled(false), 2500)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const pad = (n: number) => n.toString().padStart(2, "0")
  const heroBg = video.thumbnailUrl || "/images/img.png"
  const kicker = video.categoryName
    ? `UPCOMING SCENE | ${video.categoryName.toUpperCase()}`
    : "UPCOMING SCENE | COMING SOON"

  return (
    <main className="flex-1 flex flex-col">
      <div className="relative w-full min-h-[78vh] flex items-center justify-center overflow-hidden px-4 py-20">
        <Image
          src={heroBg}
          alt={video.title}
          fill
          referrerPolicy="no-referrer"
          className="object-cover brightness-[0.22] scale-105 blur-sm"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 max-w-5xl w-full flex flex-col lg:flex-row items-center gap-10">
          {video.thumbnailUrl && (
            <div className="relative w-full max-w-md lg:w-[440px] aspect-[16/10] flex-shrink-0 overflow-hidden border border-white/15 bg-black">
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                fill
                referrerPolicy="no-referrer"
                className="object-cover brightness-[0.42]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/25" />
            </div>
          )}

          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <span
              className="px-4 py-1.5 mb-4 text-xs font-bold tracking-[0.22em] uppercase"
              style={{
                backgroundColor: "var(--cs-label-bg, #2D3748)",
                color: "var(--cs-label-color, #FFFFFF)",
              }}
            >
              {kicker}
            </span>

            <h1
              className="font-montserrat font-bold mb-3 px-5 py-2.5"
              style={{
                backgroundColor: "var(--cs-name-bg, #2D3748)",
                color: "var(--cs-name-color, #FFFFFF)",
                fontSize: "clamp(24px, 3vw, 36px)",
                lineHeight: 1.2,
              }}
            >
              {video.title}
            </h1>

            {video.performers.length > 0 && (
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4 text-sm uppercase tracking-wider font-semibold">
                <span style={{ color: "var(--cs-letter-color, #9CA3AF)" }}>Starring</span>
                {video.performers.map((performer, idx) => (
                  <span key={performer.id} className="inline-flex items-center gap-2">
                    <Link
                      href={`/performers/${performer.slug}`}
                      className="hover:underline transition-colors"
                      style={{ color: "var(--brand-color, #FA4860)" }}
                    >
                      {performer.name}
                    </Link>
                    {idx < video.performers.length - 1 && (
                      <span className="text-white/40">&amp;</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {formattedRelease && (
              <div
                className="flex items-center gap-2 text-xs sm:text-sm uppercase tracking-wider mb-5"
                style={{ color: "var(--text-secondary, #D1D5DB)" }}
              >
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "var(--brand-color, #FA4860)" }} />
                <span>Premieres {formattedRelease}</span>
              </div>
            )}

            {video.description ? (
              <p
                className="text-sm sm:text-base mb-8 max-w-xl line-clamp-3"
                style={{ color: "var(--text-secondary, #D1D5DB)" }}
              >
                {video.description}
              </p>
            ) : (
              <p
                className="text-sm sm:text-base mb-8 max-w-xl"
                style={{ color: "var(--text-secondary, #D1D5DB)" }}
              >
                This scene is scheduled and will unlock automatically as soon as the countdown reaches zero.
              </p>
            )}

            {video.releaseDate ? (
              <div className="flex gap-6 sm:gap-8 mb-8">
                {[
                  { value: timeLeft.days, label: "D" },
                  { value: timeLeft.hours, label: "H" },
                  { value: timeLeft.minutes, label: "M" },
                  { value: timeLeft.seconds, label: "S" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <span
                      className="text-4xl sm:text-5xl font-bold tabular-nums leading-none"
                      style={{ color: "var(--cs-number-color, #FFFFFF)" }}
                    >
                      {pad(item.value)}
                    </span>
                    <span
                      className="text-xs font-semibold mt-1.5 tracking-widest"
                      style={{ color: "var(--cs-letter-color, #9CA3AF)" }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p
                className="text-sm font-medium uppercase tracking-wider mb-8"
                style={{ color: "var(--cs-letter-color, #9CA3AF)" }}
              >
                Release date to be announced
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
              <button
                type="button"
                onClick={handleNotify}
                disabled={loading}
                className="flex items-center gap-2 px-7 py-3.5 text-sm font-bold tracking-wide uppercase transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: subscribed
                    ? "var(--brand-color, #40E0D0)"
                    : "var(--cs-button-bg, #F4A0AB)",
                  color: "var(--cs-button-color, #FFFFFF)",
                }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : subscribed ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Bell className="w-4 h-4" />
                )}
                <span>{loading ? "..." : subscribed ? "Subscribed" : "Notify Me"}</span>
              </button>

              <Link
                href="/videos"
                className="px-6 py-3.5 text-sm font-semibold uppercase tracking-wide border border-white/25 text-white hover:bg-white/10 transition-colors"
              >
                Browse Videos
              </Link>
            </div>

            {justToggled && (
              <div
                className="mt-4 px-4 py-2 text-xs font-medium"
                style={{
                  backgroundColor: subscribed
                    ? "rgba(64, 224, 208, 0.15)"
                    : "rgba(255,255,255,0.1)",
                  color: subscribed
                    ? "var(--brand-color, #40E0D0)"
                    : "var(--cs-letter-color, #9CA3AF)",
                  border: subscribed
                    ? "1px solid rgba(64, 224, 208, 0.3)"
                    : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {subscribed
                  ? "You'll be notified by email as soon as this scene premieres!"
                  : "Notification removed"}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
