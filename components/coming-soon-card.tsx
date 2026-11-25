"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function useCountdown(targetDate?: string | null, onComplete?: () => void): TimeLeft {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const expiredRef = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    expiredRef.current = false
    if (!targetDate) return

    const targetMs = new Date(targetDate).getTime()
    if (Number.isNaN(targetMs)) return

    const calculate = (): TimeLeft => {
      const diff = targetMs - Date.now()
      if (diff <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true
          onCompleteRef.current?.()
        }
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      }
    }

    setTimeLeft(calculate())
    const timer = setInterval(() => setTimeLeft(calculate()), 1000)
    return () => clearInterval(timer)
  }, [targetDate])

  return timeLeft
}

function BellIcon({ ringing }: { ringing?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: "clamp(11px, 5.5cqw, 18px)", height: "clamp(11px, 5.5cqw, 18px)" }}
      className={`flex-shrink-0 ${ringing ? "animate-[ring_0.5s_ease-in-out]" : ""}`}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

interface ComingSoonCardProps {
  performerId?: string
  name: string
  image?: string | null
  comingSoonDate?: string | null
  aspectClassName?: string
  onExpire?: () => void
}

export function ComingSoonCard({
  performerId,
  name,
  image,
  comingSoonDate,
  aspectClassName = "aspect-[9/16]",
  onExpire,
}: ComingSoonCardProps) {
  const timeLeft = useCountdown(comingSoonDate, onExpire)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [justToggled, setJustToggled] = useState(false)
  const pad = (n: number) => n.toString().padStart(2, "0")

  useEffect(() => {
    if (!performerId) return
    fetch(`/api/performers/${performerId}/notify`)
      .then((r) => r.json())
      .then((data) => setSubscribed(Boolean(data.subscribed)))
      .catch(() => {})
  }, [performerId])

  const handleNotify = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!performerId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/performers/${performerId}/notify`, { method: "POST" })
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

  return (
    <div
      className={`relative ${aspectClassName} overflow-hidden select-none bg-zinc-900`}
      style={{ containerType: "inline-size" }}
    >
      {image ? (
        <Image
          src={image}
          alt={name}
          fill
          className="object-cover brightness-[0.3]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 20vw"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <span
            className="font-bold text-zinc-700"
            style={{ fontSize: "24cqw" }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-black/40" />

      <div
        className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center"
        style={{ paddingInline: "5.5cqw" }}
      >
        <div
          className="font-bold tracking-widest uppercase max-w-full truncate"
          style={{
            backgroundColor: "var(--cs-label-bg, #2D3748)",
            color: "var(--cs-label-color, #FFFFFF)",
            padding: "2cqw 5cqw",
            marginBottom: "4.5cqw",
            fontSize: "clamp(8px, 4.1cqw, 13px)",
            lineHeight: 1.2,
          }}
        >
          NEW PERFORMER
        </div>

        <div
          className="font-bold text-center max-w-full truncate"
          style={{
            backgroundColor: "var(--cs-name-bg, #2D3748)",
            color: "var(--cs-name-color, #FFFFFF)",
            padding: "2.6cqw 6cqw",
            marginBottom: "7.5cqw",
            fontSize: "clamp(11px, 6.2cqw, 20px)",
            lineHeight: 1.25,
          }}
        >
          {name}
        </div>

        <div
          className="flex items-start justify-center"
          style={{ gap: "5cqw", marginBottom: "7.5cqw" }}
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
                  fontSize: "clamp(15px, 10.5cqw, 34px)",
                }}
              >
                {pad(item.value)}
              </span>
              <span
                className="font-medium leading-none"
                style={{
                  color: "var(--cs-letter-color, #9CA3AF)",
                  fontSize: "clamp(8px, 4cqw, 13px)",
                  marginTop: "1.5cqw",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Notify Button */}
        <button
          type="button"
          onClick={handleNotify}
          disabled={loading}
          className="flex items-center justify-center font-bold tracking-wide uppercase transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 cursor-pointer whitespace-nowrap"
          style={{
            gap: "2.5cqw",
            padding: "3.8cqw 8.5cqw",
            fontSize: "clamp(9.5px, 4.8cqw, 15px)",
            lineHeight: 1.1,
            backgroundColor: subscribed ? "var(--brand-color, #40E0D0)" : "var(--cs-button-bg, #F4A0AB)",
            color: "var(--cs-button-color, #FFFFFF)",
            boxShadow: subscribed ? "0 0 20px rgba(64, 224, 208, 0.3)" : "none",
          }}
        >
          {loading ? (
            <span
              className="animate-spin border-2 border-current border-t-transparent rounded-full"
              style={{ width: "clamp(10px, 5cqw, 16px)", height: "clamp(10px, 5cqw, 16px)" }}
            />
          ) : (
            <BellIcon ringing={justToggled && subscribed} />
          )}
          <span>{loading ? "..." : subscribed ? "Subscribed ✓" : "Notify Me"}</span>
        </button>

        {/* Toast feedback */}
        {justToggled && (
          <div
            className="font-medium animate-[fadeInUp_0.3s_ease-out] max-w-full"
            style={{
              marginTop: "4.5cqw",
              padding: "2.4cqw 4.5cqw",
              fontSize: "clamp(9px, 4cqw, 13px)",
              lineHeight: 1.25,
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
  )
}
