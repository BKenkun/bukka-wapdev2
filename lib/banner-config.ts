import type { BannerContentPosition } from "@/lib/banner-utils"

export type BannerBgSource = "image" | "uploadedVideo" | "dbVideo"

export type BannerVideoSource =
  | "manual"
  | "latest"
  | "popular"
  | "popular_weekly"
  | "trending"
  | "category"
  | "tag"

export type BannerRotationMode = "fixed" | "sequential" | "random"

export type BannerContentMode = "auto" | "custom"

export type BannerVideoItemContentMode = "auto" | "inherit" | "custom"

export interface BannerVideoItemOverride {
  contentMode?: BannerVideoItemContentMode
  kicker?: string
  title?: string
  description?: string
  buttonText?: string
  buttonLinkType?: "url" | "page"
  buttonUrl?: string
  buttonPageId?: string | null
  openInNewTab?: boolean
  customEffects?: boolean
  overlayEnabled?: boolean
  overlayOpacity?: number
  overlayColor?: string
  blurEnabled?: boolean
  blurIntensity?: number
}

export interface UnifiedBannerConfig {
  // Background source
  bgSource?: BannerBgSource
  backgroundImage?: string
  videoUrl?: string

  // DB video selection & rotation
  dbVideoSource?: BannerVideoSource
  dbVideoIds?: string[]
  dbCategorySlug?: string
  dbTagSlug?: string
  dbVideoLimit?: number
  rotationMode?: BannerRotationMode

  // Legacy single DB video fields (kept for full backwards compatibility)
  dbVideoId?: string | null
  dbVideoSlug?: string | null
  dbVideoTitle?: string | null
  dbVideoThumbnail?: string | null
  dbVideoMuxPlaybackId?: string | null
  dbVideoCategory?: string | null

  // Content & CTA settings
  contentMode?: BannerContentMode
  autoKickerPrefix?: string
  autoButtonText?: string
  kicker?: string
  title?: string
  description?: string
  buttonText?: string
  buttonLinkType?: "url" | "page"
  buttonUrl?: string
  buttonPageId?: string | null
  openInNewTab?: boolean

  // Legacy HERO full-banner link fields
  linkType?: "url" | "page"
  linkUrl?: string | null
  linkPageId?: string | null

  // Per-video overrides for manual DB video sequences
  videoOverrides?: Record<string, BannerVideoItemOverride>

  // Visual effects (global defaults)
  overlayEnabled?: boolean
  overlayOpacity?: number
  overlayColor?: string
  blurEnabled?: boolean
  blurIntensity?: number

  // Layout & Typography
  fullHeight?: boolean
  height?: number
  contentPosition?: BannerContentPosition
  titleFontFamily?: string
  titleFontSize?: number
  buttonBgColor?: string
  buttonHoverColor?: string
  buttonTextColor?: string
  buttonHoverTextColor?: string
}

export interface ResolvedBannerSlide {
  id: string
  kicker?: string
  title: string
  description: string
  buttonText: string
  buttonUrl?: string
  openInNewTab?: boolean
  fullBannerLinkUrl?: string
  backgroundImage?: string
  videoUrl?: string
  overlayEnabled: boolean
  overlayOpacity?: number
  overlayColor: string
  blurEnabled: boolean
  blurIntensity: number
}

export function getEffectiveBgSource(
  config: UnifiedBannerConfig,
  sectionType: "HERO" | "CTA_BANNER"
): BannerBgSource {
  if (config.bgSource === "image" || config.bgSource === "uploadedVideo" || config.bgSource === "dbVideo") {
    return config.bgSource
  }
  if (sectionType === "HERO" && config.videoUrl?.trim()) {
    return "uploadedVideo"
  }
  if (config.dbVideoId || (Array.isArray(config.dbVideoIds) && config.dbVideoIds.length > 0)) {
    return "dbVideo"
  }
  return "image"
}

export function getNormalizedManualVideoIds(config: UnifiedBannerConfig): string[] {
  if (Array.isArray(config.dbVideoIds) && config.dbVideoIds.length > 0) {
    return config.dbVideoIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
  }
  if (typeof config.dbVideoId === "string" && config.dbVideoId.trim().length > 0) {
    return [config.dbVideoId.trim()]
  }
  return []
}
