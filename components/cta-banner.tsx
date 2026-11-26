"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BannerKicker } from "@/components/banner-kicker"
import {
  BannerContentPosition,
  hexToRgba,
  sanitizeBannerUrl,
} from "@/lib/banner-utils"
import type { BannerRotationMode, ResolvedBannerSlide } from "@/lib/banner-config"

interface CtaBannerProps {
  kicker?: string
  title?: string
  description?: string
  buttonText?: string
  buttonUrl?: string
  openInNewTab?: boolean
  fullBannerLinkUrl?: string
  backgroundImage?: string
  videoUrl?: string
  slides?: ResolvedBannerSlide[]
  rotationMode?: BannerRotationMode
  sectionId?: string
  fullHeight?: boolean
  headingTag?: "h1" | "h2"
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
  title = "",
  description = "",
  buttonText = "",
  buttonUrl,
  openInNewTab = false,
  fullBannerLinkUrl,
  backgroundImage = "/red-lips-artistic.jpg",
  videoUrl,
  slides,
  rotationMode = "fixed",
  sectionId,
  fullHeight = false,
  headingTag = "h2",
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
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedVideoUrl, setFailedVideoUrl] = useState<string | null>(null)

  const slideList: ResolvedBannerSlide[] =
    slides && slides.length > 0
      ? slides
      : [
          {
            id: "single",
            kicker,
            title,
            description,
            buttonText,
            buttonUrl,
            openInNewTab,
            fullBannerLinkUrl,
            backgroundImage,
            videoUrl,
            overlayEnabled,
            overlayOpacity,
            overlayColor,
            blurEnabled,
            blurIntensity,
          },
        ]

  const slideCount = slideList.length

  useEffect(() => {
    if (slideCount <= 1 || rotationMode === "fixed") {
      setActiveIndex(0)
      return
    }

    const storageKey = `bukkakery_banner_rot_${sectionId || "default"}`
    let prevIndex: number | null = null
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw !== null) {
        const parsed = parseInt(raw, 10)
        if (Number.isInteger(parsed) && parsed >= 0) {
          prevIndex = parsed
        }
      }
    } catch {
      // Ignore storage access restrictions
    }

    let nextIndex = 0
    if (rotationMode === "sequential") {
      nextIndex = prevIndex === null ? 0 : (prevIndex + 1) % slideCount
    } else if (rotationMode === "random") {
      const candidateCount = prevIndex !== null && prevIndex < slideCount ? slideCount - 1 : slideCount
      let pick = Math.floor(Math.random() * candidateCount)
      if (prevIndex !== null && prevIndex < slideCount && pick >= prevIndex) {
        pick += 1
      }
      nextIndex = pick % slideCount
    }

    try {
      window.localStorage.setItem(storageKey, String(nextIndex))
    } catch {
      // Ignore storage write errors
    }

    setActiveIndex(nextIndex)
  }, [slideCount, rotationMode, sectionId])

  const activeSlide = slideList[activeIndex] || slideList[0]
  const activeVideoUrl = activeSlide.videoUrl?.trim() || undefined
  const activeBgImage = activeSlide.backgroundImage?.trim() || "/placeholder.svg"
  const showVideo = Boolean(activeVideoUrl && failedVideoUrl !== activeVideoUrl)

  const blurStyle = activeSlide.blurEnabled
    ? { filter: `blur(${activeSlide.blurIntensity}px)`, transform: "scale(1.1)" }
    : undefined

  const positionMap: Record<
    BannerContentPosition,
    { items: string; justify: string; text: string; align: "left" | "center" | "right" }
  > = {
    "top-left": { items: "items-start", justify: "justify-start", text: "text-left", align: "left" },
    "top-center": { items: "items-center", justify: "justify-start", text: "text-center", align: "center" },
    "top-right": { items: "items-end", justify: "justify-start", text: "text-right", align: "right" },
    "center-left": { items: "items-start", justify: "justify-center", text: "text-left", align: "left" },
    center: { items: "items-center", justify: "justify-center", text: "text-center", align: "center" },
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

  const safeButtonUrl = sanitizeBannerUrl(activeSlide.buttonUrl)
  const safeFullBannerLinkUrl = sanitizeBannerUrl(activeSlide.fullBannerLinkUrl)
  const isExternalButtonUrl = Boolean(safeButtonUrl && /^https?:\/\//i.test(safeButtonUrl))
  const isExternalFullBannerUrl = Boolean(
    safeFullBannerLinkUrl && /^https?:\/\//i.test(safeFullBannerLinkUrl)
  )

  const headlineFontSize = titleFontSize
    ? `clamp(2rem, 5.2vw, ${titleFontSize}px)`
    : "clamp(2.25rem, 5.6vw, 4.25rem)"

  const hasAnyText = Boolean(
    activeSlide.kicker || activeSlide.title || activeSlide.description || activeSlide.buttonText
  )

  const HeadingTag = headingTag === "h1" ? "h1" : "h2"

  const sectionElement = (
    <section
      className={`relative w-full flex flex-col ${pos.justify} ${pos.items} overflow-hidden bg-black ${
        fullHeight ? "min-h-screen" : ""
      } ${safeFullBannerLinkUrl && !activeSlide.buttonText ? "cursor-pointer" : ""}`}
      style={fullHeight ? undefined : { minHeight: `${height}px` }}
    >
      {/* Background Video or Image */}
      <div className="absolute inset-0 z-0">
        {showVideo && activeVideoUrl ? (
          <video
            key={activeVideoUrl}
            src={activeVideoUrl}
            poster={activeSlide.backgroundImage?.trim() || undefined}
            autoPlay
            muted
            loop
            playsInline
            onError={() => setFailedVideoUrl(activeVideoUrl)}
            className="w-full h-full object-cover"
            style={blurStyle}
          />
        ) : (
          <Image
            src={activeBgImage}
            alt={activeSlide.title || "Banner background"}
            fill
            className="object-cover"
            priority
            style={blurStyle}
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Configurable Color Overlay + Cinematic Scrim */}
      {activeSlide.overlayEnabled && (
        <div
          className="absolute inset-0 z-[1]"
          style={{
            backgroundColor:
              activeSlide.overlayOpacity !== undefined
                ? hexToRgba(activeSlide.overlayColor, activeSlide.overlayOpacity)
                : `rgba(0,0,0,var(--cta-overlay-opacity, 0.55))`,
          }}
        />
      )}
      {(hasAnyText || activeSlide.overlayEnabled) && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[2] bg-gradient-to-t from-black/70 via-black/15 to-black/35 pointer-events-none"
        />
      )}

      {/* Editorial Banner Content */}
      {hasAnyText && (
        <div
          className={`relative z-10 flex flex-col ${pos.items} ${pos.text} w-full max-w-5xl px-6 sm:px-10 py-12 sm:py-16`}
        >
          {activeSlide.kicker && (
            <BannerKicker text={activeSlide.kicker} align={pos.align} className="mb-3 sm:mb-4" />
          )}

          {activeSlide.title && (
            <HeadingTag
              className="font-black uppercase tracking-[-0.02em] leading-[1.03] [text-wrap:balance] drop-shadow-[0_6px_26px_rgba(0,0,0,0.65)]"
              style={{
                color: "var(--cta-title-color, #FFFFFF)",
                fontSize: headlineFontSize,
                fontFamily:
                  titleFontFamily ||
                  "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
              }}
            >
              {activeSlide.title}
            </HeadingTag>
          )}

          {activeSlide.description && (
            <p
              className="mt-4 text-sm sm:text-base md:text-lg font-medium tracking-[0.03em] max-w-2xl leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
              style={{
                color: "var(--cta-desc-color, rgba(255,255,255,0.88))",
                fontFamily:
                  "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
              }}
            >
              {activeSlide.description}
            </p>
          )}

          {activeSlide.buttonText && (
            <div className="mt-8">
              {safeButtonUrl ? (
                activeSlide.openInNewTab || isExternalButtonUrl ? (
                  <a
                    href={safeButtonUrl}
                    target={activeSlide.openInNewTab ? "_blank" : undefined}
                    rel={activeSlide.openInNewTab ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center justify-center gap-2.5 uppercase px-9 py-3.5 sm:py-4 font-extrabold text-xs sm:text-sm tracking-[0.2em] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                    style={buttonStyle}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <span>{activeSlide.buttonText}</span>
                    <ArrowRight className="size-4" />
                  </a>
                ) : (
                  <Link
                    href={safeButtonUrl}
                    className="inline-flex items-center justify-center gap-2.5 uppercase px-9 py-3.5 sm:py-4 font-extrabold text-xs sm:text-sm tracking-[0.2em] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                    style={buttonStyle}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                  >
                    <span>{activeSlide.buttonText}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2.5 uppercase px-9 py-3.5 sm:py-4 font-extrabold text-xs sm:text-sm tracking-[0.2em] transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                  style={buttonStyle}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  <span>{activeSlide.buttonText}</span>
                  <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )

  // Legacy clickable full-banner HERO when there's a linkUrl/linkPageId and no CTA button
  if (safeFullBannerLinkUrl && !activeSlide.buttonText) {
    if (activeSlide.openInNewTab || isExternalFullBannerUrl) {
      return (
        <a
          href={safeFullBannerLinkUrl}
          target={activeSlide.openInNewTab ? "_blank" : undefined}
          rel={activeSlide.openInNewTab ? "noopener noreferrer" : undefined}
          className="block"
        >
          {sectionElement}
        </a>
      )
    }

    return (
      <Link href={safeFullBannerLinkUrl} className="block">
        {sectionElement}
      </Link>
    )
  }

  return sectionElement
}
