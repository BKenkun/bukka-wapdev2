"use client"

import { useRouter } from "next/navigation"
import { Eye, Lock, Calendar } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useSubscription } from "@/hooks/use-subscription"
import { useAuthModal } from "@/components/auth/auth-modal-provider"
import { VideoComingSoonCard } from "@/components/video-coming-soon-card"
import { shouldApplyTrailerLimit } from "@/lib/video-access"
import { getOptimizedImageUrl } from "@/lib/cloudflare-image-loader"

// Play icon SVG component
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

// Format date to Spanish format "13 de noviembre de 2025"
function formatPublishDate(date: Date | string): string {
  const d = new Date(date)
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ]
  const day = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} de ${month} de ${year}`
}

interface Performer {
  name: string
  slug: string
}

export interface VideoCardProps {
  title: string
  subtitle?: string
  views: string
  likes?: string
  imageUrl: string
  previewUrl?: string
  previewStartTime?: number
  previewEndTime?: number
  isVerified?: boolean
  variant?: "overlay" | "below"
  slug?: string
  videoId?: string
  category?: string
  performers?: Performer[]
  publishedAt?: Date | string
  comingSoon?: boolean
  releaseDate?: string | null
  isNew?: boolean
  minTierLevel?: number | null
  isDiamondExclusive?: boolean
  isLimitedEdition?: boolean
  limitedAccessUntil?: string | null
  aspectClassName?: string
  featured?: boolean
}

export function VideoCard({
  title,
  subtitle,
  views,
  likes,
  imageUrl,
  previewUrl,
  previewStartTime = 0,
  previewEndTime,
  isVerified = true,
  variant = "overlay",
  slug = "video-ejemplo",
  videoId,
  category,
  performers = [],
  publishedAt,
  comingSoon = false,
  releaseDate,
  isNew = false,
  minTierLevel = 0,
  isDiamondExclusive = false,
  isLimitedEdition = false,
  limitedAccessUntil = null,
  aspectClassName = "aspect-[476/309]",
  featured = false,
}: VideoCardProps) {
  const router = useRouter()
  const [isHovering, setIsHovering] = useState(false)
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false)
  const [hasActivatedPreview, setHasActivatedPreview] = useState(false)
  const [activePreviewUrl, setActivePreviewUrl] = useState<string | undefined>(previewUrl)
  const [previewFormat, setPreviewFormat] = useState<"video" | "image">("video")
  const [previewFailed, setPreviewFailed] = useState(false)
  const [showTrailerLimit, setShowTrailerLimit] = useState(false)
  const [liveUnlocked, setLiveUnlocked] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasTriedFallbackRef = useRef(false)
  const isHoveringRef = useRef(false)

  const {
    canViewTrailer,
    trackTrailerView,
    isAuthenticated,
    planLevel,
    canAccessExclusive,
    canAccessLimitedEdition,
  } = useSubscription()
  const { openAuthModal } = useAuthModal()

  // Sync active preview URL if prop changes
  useEffect(() => {
    setActivePreviewUrl(previewUrl)
    setPreviewFormat("video")
    setPreviewFailed(false)
    setIsPreviewLoaded(false)
    hasTriedFallbackRef.current = false
  }, [previewUrl])

  useEffect(() => {
    setLiveUnlocked(false)
  }, [comingSoon, releaseDate])

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  const handleComingSoonExpire = () => {
    setLiveUnlocked(true)
    fetch("/api/videos/release", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        router.refresh()
      })
  }

  if (comingSoon && !liveUnlocked) {
    return (
      <VideoComingSoonCard
        videoId={videoId}
        slug={slug}
        title={title}
        imageUrl={imageUrl}
        releaseDate={releaseDate}
        category={category}
        performers={performers}
        variant={variant}
        onExpire={handleComingSoonExpire}
      />
    )
  }

  const showNewBadge = isNew || liveUnlocked
  const effectiveVideoId = videoId || slug

  // Solo aplicar límite de trailers a videos con restricción Free (level >= 1) o superior
  // (o exclusivos / edición limitada activa) cuando el usuario NO tiene acceso completo
  const needsTrailerLimit = shouldApplyTrailerLimit(
    {
      isAuthenticated,
      planLevel,
      canAccessExclusive,
      canAccessLimitedEdition,
    },
    {
      minTierLevel,
      isDiamondExclusive,
      isLimitedEdition,
      limitedAccessUntil,
    }
  )

  const tryResolvePreviewFallback = async () => {
    if (hasTriedFallbackRef.current || !slug) {
      setPreviewFailed(true)
      setIsPreviewLoaded(false)
      return
    }
    hasTriedFallbackRef.current = true

    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(slug)}/preview`)
      if (!res.ok) {
        setPreviewFailed(true)
        setIsPreviewLoaded(false)
        return
      }
      const data = await res.json()
      if (data?.previewUrl && data.previewUrl !== activePreviewUrl) {
        setPreviewFormat(data.format === "image" ? "image" : "video")
        setActivePreviewUrl(data.previewUrl)
        setPreviewFailed(false)
        return
      }
      setPreviewFailed(true)
      setIsPreviewLoaded(false)
    } catch {
      setPreviewFailed(true)
      setIsPreviewLoaded(false)
    }
  }

  const startPreviewPlayback = () => {
    setIsHovering(true)
    isHoveringRef.current = true

    // Si ya tenemos URL de preview válida, activamos la carga del elemento media
    if (activePreviewUrl && !previewFailed) {
      setHasActivatedPreview(true)
      if (previewFormat === "video" && videoRef.current) {
        if (videoRef.current.readyState >= 2) {
          videoRef.current.currentTime = previewStartTime
          videoRef.current.play().catch(() => {
            // Autoplay blocked or aborted: keep thumbnail visible
          })
        } else {
          videoRef.current.play().catch(() => {})
        }
      }
      return
    }

    // Si no vino previewUrl en SSR pero podría resolverse on-demand, intentar una vez
    if (!activePreviewUrl && !hasTriedFallbackRef.current && slug) {
      setHasActivatedPreview(true)
      void tryResolvePreviewFallback()
    }
  }

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }

    // Si el video tiene restricción y el usuario ya agotó sus 3 trailers, bloquear inmediatamente
    if (needsTrailerLimit && !canViewTrailer(effectiveVideoId)) {
      setShowTrailerLimit(true)
      return
    }

    // Small delay before starting preview to avoid accidental triggers while scrolling
    hoverTimeoutRef.current = setTimeout(() => {
      if (needsTrailerLimit && !canViewTrailer(effectiveVideoId)) {
        setShowTrailerLimit(true)
        return
      }
      startPreviewPlayback()
    }, 220)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    isHoveringRef.current = false
    setIsHovering(false)
    setIsPreviewLoaded(false)
    setShowTrailerLimit(false)
    if (videoRef.current) {
      videoRef.current.pause()
      try {
        videoRef.current.currentTime = previewStartTime
      } catch {
        // Ignore seek errors if metadata isn't loaded yet
      }
    }
  }

  const handleVideoLoadedMetadata = () => {
    const el = videoRef.current
    if (!el || !isHoveringRef.current) return
    if (previewStartTime > 0 && el.duration && previewStartTime < el.duration) {
      el.currentTime = previewStartTime
    }
    el.play().catch(() => {})
  }

  const handlePreviewStarted = () => {
    if (!isHoveringRef.current) return

    // Solo contabilizar el trailer cuando el preview realmente empieza a reproducirse
    if (needsTrailerLimit) {
      const allowed = trackTrailerView(effectiveVideoId)
      if (!allowed) {
        setIsPreviewLoaded(false)
        setIsHovering(false)
        isHoveringRef.current = false
        if (videoRef.current) videoRef.current.pause()
        setShowTrailerLimit(true)
        return
      }
    }

    setIsPreviewLoaded(true)
  }

  const handleVideoError = () => {
    setIsPreviewLoaded(false)
    void tryResolvePreviewFallback()
  }

  const handleTimeUpdate = () => {
    if (videoRef.current && previewEndTime && videoRef.current.currentTime >= previewEndTime) {
      videoRef.current.currentTime = previewStartTime
    }
  }

  const handleCardClick = () => {
    // Coherencia hover + click: si el video es restringido y el usuario ya agotó sus 3 trailers,
    // no permitir saltarse el overlay haciendo click fuera del botón CTA
    if (needsTrailerLimit && !canViewTrailer(effectiveVideoId)) {
      setShowTrailerLimit(true)
      return
    }
    router.push(`/videos/${slug}`)
  }

  const handlePerformerClick = (e: React.MouseEvent, performerSlug: string) => {
    e.stopPropagation()
    router.push(`/modelos/${performerSlug}`)
  }

  const handleTrailerLimitCta = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // Cerrar el overlay para que no tape el modal de auth
    setShowTrailerLimit(false)
    setIsHovering(false)
    setIsPreviewLoaded(false)
    isHoveringRef.current = false
    if (videoRef.current) videoRef.current.pause()
    if (isAuthenticated) {
      router.push("/suscripciones")
    } else {
      openAuthModal({ view: "register" })
    }
  }

  // Solo ocultar la miniatura cuando el preview está realmente cargado y reproduciéndose (nunca pantalla negra)
  const showActivePreview = isHovering && isPreviewLoaded && !previewFailed && Boolean(activePreviewUrl)

  // Trailer limit overlay component
  const TrailerLimitOverlay = () => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30 p-4 text-center"
    >
      <Lock className="w-12 h-12 mb-3" style={{ color: "var(--brand-color)" }} />
      <h4 className="text-white font-bold text-lg mb-2">Trailer limit reached</h4>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        {isAuthenticated
          ? "You have reached your daily trailer limit. Upgrade your plan to watch more."
          : "Visitors can watch 3 trailers. Sign up to watch more."}
      </p>
      <button
        type="button"
        onClick={handleTrailerLimitCta}
        className="text-white px-6 py-2 text-sm font-medium transition-colors cursor-pointer"
        style={{ backgroundColor: "var(--brand-color)" }}
      >
        {isAuthenticated ? "View Subscriptions" : "Sign Up Free"}
      </button>
    </div>
  )

  // Render performers as clickable spans (not links to avoid nesting)
  const PerformersLinks = () => {
    if (performers.length === 0) return null
    return (
      <span
        className={`text-white font-medium drop-shadow-lg uppercase flex flex-wrap gap-1 ${
          featured ? "text-xs md:text-sm" : "text-xs"
        }`}
      >
        {performers.map((performer, index) => (
          <span key={performer.slug} className="flex items-center">
            <span
              onClick={(e) => handlePerformerClick(e, performer.slug)}
              className="transition-colors cursor-pointer"
              style={{ ["--hover-color" as string]: "var(--vc-hover-accent)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--vc-hover-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "")}
            >
              {performer.name}
            </span>
            {index < performers.length - 1 && <span className="mx-1">&</span>}
          </span>
        ))}
      </span>
    )
  }

  const mediaObjectPosition = featured ? "object-center" : "object-left"

  // Preview media layer (video MP4 o animated.webp fallback), montado lazy en hover
  const renderPreviewMedia = () => {
    if (!hasActivatedPreview || !activePreviewUrl || previewFailed) return null

    if (previewFormat === "image") {
      return (
        <img
          src={activePreviewUrl}
          alt=""
          onLoad={handlePreviewStarted}
          onError={() => {
            setPreviewFailed(true)
            setIsPreviewLoaded(false)
          }}
          className={`absolute inset-0 w-full h-full object-cover ${mediaObjectPosition} transition-opacity duration-300 ${
            showActivePreview ? "opacity-100" : "opacity-0"
          }`}
        />
      )
    }

    return (
      <video
        ref={videoRef}
        src={activePreviewUrl}
        autoPlay
        muted
        playsInline
        preload="metadata"
        loop={!previewEndTime}
        onLoadedMetadata={handleVideoLoadedMetadata}
        onPlaying={handlePreviewStarted}
        onError={handleVideoError}
        onTimeUpdate={previewEndTime ? handleTimeUpdate : undefined}
        className={`absolute inset-0 w-full h-full object-cover ${mediaObjectPosition} transition-opacity duration-300 ${
          showActivePreview ? "opacity-100" : "opacity-0"
        }`}
      />
    )
  }

  if (variant === "below") {
    return (
      <div
        className="group cursor-pointer"
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Video thumbnail / preview */}
        <div className="relative w-full aspect-[476/309] overflow-hidden mb-3 bg-black">
          {showNewBadge && (
            <span
              className="absolute top-3 right-3 z-20 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase"
              style={{ backgroundColor: "var(--brand-color, #FA4860)", color: "#FFFFFF" }}
            >
              NEW
            </span>
          )}
          {/* Trailer limit overlay */}
          {showTrailerLimit && <TrailerLimitOverlay />}

          {/* Play icon - center */}
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className={`bg-black/50 p-3 transition-transform duration-300 ${isHovering ? "scale-110" : ""}`}>
              <PlayIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Category and performers overlay - top left, only on hover */}
          {(category || performers.length > 0) && (
            <div
              className={`absolute top-2 left-2 z-10 flex flex-col gap-1 max-w-[80%] transition-opacity duration-300 ${
                isHovering ? "opacity-100" : "opacity-0"
              }`}
            >
              {category && (
                <span className="text-white text-sm font-bold drop-shadow-lg uppercase">
                  {category}
                </span>
              )}
              <PerformersLinks />
            </div>
          )}

          {/* Thumbnail image — stays visible until preview is actually playing */}
          <img
            src={getOptimizedImageUrl(imageUrl || "/placeholder.svg", featured ? 1280 : 800)}
            alt={title}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover object-left transition-all duration-300 ${
              showActivePreview ? "opacity-0" : "opacity-100 group-hover:scale-105"
            }`}
          />

          {/* Preview video / animated image */}
          {renderPreviewMedia()}
        </div>

        {/* Content below */}
        <div className="flex flex-col">
          {/* Title */}
          <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-1" style={{ color: "var(--vc-title-color)" }}>{title}</h3>

          {/* Views and Date */}
          <div className="flex items-center gap-3 text-sm" style={{ color: "var(--vc-meta-color)" }}>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{views}</span>
            </div>
            {publishedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatPublishDate(publishedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative group cursor-pointer overflow-hidden"
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video thumbnail / preview */}
      <div className={`relative w-full ${aspectClassName} bg-black`}>
        {showNewBadge && (
          <span
            className="absolute top-3 right-3 z-20 px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase"
            style={{ backgroundColor: "var(--brand-color, #FA4860)", color: "#FFFFFF" }}
          >
            NEW
          </span>
        )}
        {/* Trailer limit overlay */}
        {showTrailerLimit && <TrailerLimitOverlay />}

        {/* Play icon - center */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className={`bg-black/50 ${featured ? "p-4" : "p-3"} transition-transform duration-300 ${isHovering ? "scale-110" : ""}`}>
            <PlayIcon className={featured ? "w-10 h-10 text-white" : "w-8 h-8 text-white"} />
          </div>
        </div>

        {/* Category and performers overlay - top left, only on hover */}
        {(category || performers.length > 0) && (
          <div
            className={`absolute ${featured ? "top-3 left-3 md:top-5 md:left-6" : "top-2 left-2"} z-10 flex flex-col gap-1 max-w-[80%] transition-opacity duration-300 ${
              isHovering ? "opacity-100" : "opacity-0"
            }`}
          >
            {category && (
              <span className={`text-white font-bold drop-shadow-lg uppercase ${featured ? "text-sm md:text-base" : "text-sm"}`}>
                {category}
              </span>
            )}
            <PerformersLinks />
          </div>
        )}

        {/* Thumbnail image — stays visible until preview is actually playing */}
        <img
          src={getOptimizedImageUrl(imageUrl || "/placeholder.svg", featured ? 1280 : 800)}
          alt={title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full object-cover ${mediaObjectPosition} transition-opacity duration-300 ${
            showActivePreview ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Preview video / animated image */}
        {renderPreviewMedia()}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Content overlay */}
        <div className={`absolute inset-0 ${featured ? "p-4 md:p-6" : "p-4"} flex flex-col justify-end`}>
          {/* Title */}
          <h3
            className={`font-bold leading-tight mb-2 ${featured ? "text-lg md:text-2xl" : "text-lg"}`}
            style={{ color: "var(--vc-title-color)" }}
          >
            {title}
          </h3>

          {/* Views and Date */}
          <div className="flex items-center gap-3 text-white text-sm">
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{views}</span>
            </div>
            {publishedAt && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{formatPublishDate(publishedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
