"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BannerKicker } from "@/components/banner-kicker"
import {
  BannerContentPosition,
  hexToRgba,
  sanitizeBannerUrl,
} from "@/lib/banner-utils"

interface CtaBannerProps {
  kicker?: string
  title: string
  description: string
  buttonText: string
  buttonUrl?: string
  backgroundImage?: string
  videoUrl?: string
  titleFontFamily?: string
  titleFontSize?: number
  buttonBgColor?: string
  buttonHoverColor?: string
  buttonTextColor?: string
  buttonHoverTextColor?: string
  overlayEnabled?: boolean
  overlayOpacity?: number
  overlayColor?: string
  blurEnabled?: boolean
  blurIntensity?: number
  height?: number
  contentPosition?: BannerContentPosition
}

export function CtaBanner({
  kicker,
  title,
  description,
  buttonText,
  buttonUrl,
  backgroundImage = "/red-lips-artistic.jpg",
  videoUrl,
  titleFontFamily,
  titleFontSize,
  buttonBgColor,
  buttonHoverColor,
  buttonTextColor,
  buttonHoverTextColor,
  overlayEnabled = true,
  overlayOpacity,
  overlayColor = "#000000",
  blurEnabled = false,
  blurIntensity = 4,
  height = 486,
  contentPosition = "center",
}: CtaBannerProps) {
  const [isHovered, setIsHovered] = useState(false)

  const blurStyle = blurEnabled
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

  const buttonStyle = {
    backgroundColor: isHovered
      ? buttonHoverColor || buttonBgColor || "var(--brand-color-hover, #e03e54)"
      : buttonBgColor || "var(--brand-color, #FA4860)",
    color: isHovered
      ? buttonHoverTextColor || buttonTextColor || "#FFFFFF"
      : buttonTextColor || "#FFFFFF",
    fontFamily: "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
  }

  const safeButtonUrl = sanitizeBannerUrl(buttonUrl)
  const headlineFontSize = titleFontSize
    ? `clamp(2rem, 5.2vw, ${titleFontSize}px)`
    : "clamp(2.25rem, 5.6vw, 4.25rem)"

  return (
    <section
      className={`relative w-full flex flex-col ${pos.justify} ${pos.items} overflow-hidden bg-black`}
      style={{ minHeight: `${height}px` }}
    >
      {/* Background Video or Image */}
      <div className="absolute inset-0 z-0">
        {videoUrl?.trim() ? (
          <video
            src={videoUrl.trim()}
            poster={backgroundImage?.trim() || undefined}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={blurStyle}
          />
        ) : (
          <Image
            src={backgroundImage?.trim() || "/placeholder.svg"}
            alt={title || "Banner background"}
            fill
            className="object-cover"
            priority
            style={blurStyle}
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Configurable Color Overlay + Cinematic Scrim */}
      {overlayEnabled && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            backgroundColor:
              overlayOpacity !== undefined
                ? hexToRgba(overlayColor, overlayOpacity)
                : `rgba(0,0,0,var(--cta-overlay-opacity, 0.55))`,
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[2] bg-gradient-to-t from-black/70 via-black/15 to-black/35 pointer-events-none"
      />

      {/* Editorial Banner Content */}
      <div className={`relative z-10 flex flex-col ${pos.items} ${pos.text} w-full max-w-5xl px-6 sm:px-10 py-12 sm:py-16`}>
        {kicker && (
          <BannerKicker text={kicker} align={pos.align} className="mb-3 sm:mb-4" />
        )}

        {title && (
          <h2
            className="font-black uppercase tracking-[-0.02em] leading-[1.03] [text-wrap:balance] drop-shadow-[0_6px_26px_rgba(0,0,0,0.65)]"
            style={{
              color: "var(--cta-title-color, #FFFFFF)",
              fontSize: headlineFontSize,
              fontFamily:
                titleFontFamily ||
                "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
            }}
          >
            {title}
          </h2>
        )}

        {description && (
          <p
            className="mt-4 text-sm sm:text-base md:text-lg font-medium tracking-[0.03em] max-w-2xl leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
            style={{
              color: "var(--cta-desc-color, rgba(255,255,255,0.88))",
              fontFamily:
                "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
            }}
          >
            {description}
          </p>
        )}

        {buttonText && (
          <div className="mt-8">
            {safeButtonUrl ? (
              <Link
                href={safeButtonUrl}
                className="inline-flex items-center justify-center gap-2.5 uppercase px-9 py-3.5 sm:py-4 font-extrabold text-xs sm:text-sm tracking-[0.2em] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={buttonStyle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <span>{buttonText}</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2.5 uppercase px-9 py-3.5 sm:py-4 font-extrabold text-xs sm:text-sm tracking-[0.2em] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={buttonStyle}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <span>{buttonText}</span>
                <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
