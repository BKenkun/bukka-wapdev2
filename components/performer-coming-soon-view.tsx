"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface PerformerComingSoonViewProps {
  performer: {
    id: string
    slug: string
    name: string
    profileImage: string | null
    coverImage: string | null
    comingSoonDate: string | null
  }
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function PerformerComingSoonView({ performer }: PerformerComingSoonViewProps) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [justToggled, setJustToggled] = useState(false)
  const unlockedTriggeredRef = useRef(false)

  useEffect(() => {
    fetch(`/api/performers/${performer.id}/notify`)
      .then((r) => r.json())
      .then((data) => setSubscribed(Boolean(data.subscribed)))
      .catch(() => {})
  }, [performer.id])

  useEffect(() => {
    unlockedTriggeredRef.current = false
    if (!performer.comingSoonDate) return

    const targetMs = new Date(performer.comingSoonDate).getTime()
    if (Number.isNaN(targetMs)) return

    const update = () => {
      const diff = targetMs - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        if (!unlockedTriggeredRef.current) {
          unlockedTriggeredRef.current = true
          fetch("/api/performers/release", { method: "POST" })
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
  }, [performer.comingSoonDate, router])

  const handleNotify = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/performers/${performer.id}/notify`, { method: "POST" })
      if (res.status === 401) {
        window.location.href = "/?login=true"
        return
      }
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
  const heroBg = performer.coverImage || performer.profileImage || "/images/img.png"

  return (
    <main className="flex-1 flex flex-col">
      <div className="relative w-full min-h-[75vh] flex items-center justify-center overflow-hidden px-4 py-16">
        <Image
          src={heroBg}
          alt={performer.name}
          fill
          className="object-cover brightness-[0.22] scale-105 blur-sm"
          priority
        />
        <div className="absolute inset-0 bg-black/55" />

        <div className="relative z-10 max-w-4xl w-full flex flex-col lg:flex-row items-center gap-10">
          {performer.profileImage && (
            <div className="relative w-64 sm:w-72 aspect-[9/16] flex-shrink-0 overflow-hidden border border-white/10">
              <Image
                src={performer.profileImage}
                alt={performer.name}
                fill
                className="object-cover brightness-[0.4]"
                priority
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>
          )}

          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left">
            <span
              className="px-4 py-1.5 mb-4 text-xs font-bold tracking-widest uppercase"
              style={{ backgroundColor: "var(--cs-label-bg, #2D3748)", color: "var(--cs-label-color, #FFFFFF)" }}
            >
              NEW PERFORMER · COMING SOON
            </span>

            <h1
              className="font-montserrat font-bold mb-4 px-5 py-2"
              style={{
                backgroundColor: "var(--cs-name-bg, #2D3748)",
                color: "var(--cs-name-color, #FFFFFF)",
                fontSize: "34px",
                lineHeight: "42px",
              }}
            >
              {performer.name}
            </h1>

            <p className="text-sm sm:text-base mb-8 max-w-lg" style={{ color: "var(--text-secondary, #D1D5DB)" }}>
              This performer&apos;s profile is scheduled and will unlock automatically when the countdown reaches zero.
            </p>

            {performer.comingSoonDate ? (
              <div className="flex gap-6 mb-8">
                {[
                  { value: timeLeft.days, label: "D" },
                  { value: timeLeft.hours, label: "H" },
                  { value: timeLeft.minutes, label: "M" },
                  { value: timeLeft.seconds, label: "S" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <span
                      className="text-4xl sm:text-5xl font-bold tabular-nums"
                      style={{ color: "var(--cs-number-color, #FFFFFF)" }}
                    >
                      {pad(item.value)}
                    </span>
                    <span
                      className="text-xs font-semibold mt-1"
                      style={{ color: "var(--cs-letter-color, #9CA3AF)" }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium uppercase tracking-wider mb-8" style={{ color: "var(--cs-letter-color, #9CA3AF)" }}>
                Release date to be announced
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleNotify}
                disabled={loading}
                className="flex items-center gap-2 px-7 py-3.5 text-sm font-bold tracking-wide uppercase transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 cursor-pointer"
                style={{
                  backgroundColor: subscribed ? "var(--brand-color, #40E0D0)" : "var(--cs-button-bg, #F4A0AB)",
                  color: "var(--cs-button-color, #FFFFFF)",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {loading ? "..." : subscribed ? "Subscribed ✓" : "Notify Me"}
              </button>

              <Link
                href="/performers"
                className="px-6 py-3.5 text-sm font-semibold uppercase tracking-wide border border-white/25 text-white hover:bg-white/10 transition-colors"
              >
                Browse Performers
              </Link>
            </div>

            {justToggled && (
              <div
                className="mt-4 px-4 py-2 text-xs font-medium"
                style={{
                  backgroundColor: subscribed ? "rgba(64, 224, 208, 0.15)" : "rgba(255,255,255,0.1)",
                  color: subscribed ? "var(--brand-color, #40E0D0)" : "var(--cs-letter-color, #9CA3AF)",
                  border: subscribed ? "1px solid rgba(64, 224, 208, 0.3)" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {subscribed
                  ? "You'll be notified when this performer debuts!"
                  : "Notification removed"}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
