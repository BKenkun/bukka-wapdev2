import { prisma } from "@/lib/prisma"
import { getVideoPreviewUrl, getVideoToken, isMuxSigningConfigured } from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import { isVideoNew } from "@/lib/video-status"
import {
  getEffectiveBgSource,
  getNormalizedManualVideoIds,
  type BannerRotationMode,
  type BannerVideoItemOverride,
  type ResolvedBannerSlide,
  type UnifiedBannerConfig,
} from "@/lib/banner-config"

interface DbBannerVideo {
  id: string
  slug: string
  title: string
  description: string | null
  thumbnailUrl: string
  previewUrl: string | null
  muxPlaybackId: string | null
  status: string
  publishedAt: Date | null
  releaseDate: Date | null
  performers: Array<{ performer: { name: string } }>
  categories: Array<{ category: { name: string } }>
}

const bannerVideoSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  previewUrl: true,
  muxPlaybackId: true,
  status: true,
  publishedAt: true,
  releaseDate: true,
  performers: {
    include: {
      performer: { select: { name: true } },
    },
  },
  categories: {
    include: {
      category: { select: { name: true } },
    },
    take: 1,
  },
} as const

async function resolvePageSlugMap(pageIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(pageIds.filter((id): id is string => Boolean(id && id.trim()))))
  if (uniqueIds.length === 0) return new Map()

  const pages = await prisma.page.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, slug: true },
  })
  return new Map(pages.map((p) => [p.id, `/${p.slug}`]))
}

async function resolveDbVideoMediaUrl(video: DbBannerVideo): Promise<string | undefined> {
  if (video.previewUrl?.trim()) {
    return video.previewUrl.trim()
  }

  if (video.muxPlaybackId && isMuxSigningConfigured()) {
    try {
      const token = await getVideoToken(video.muxPlaybackId)
      return getVideoPreviewUrl(video.muxPlaybackId, token, "capped-1080p")
    } catch (error) {
      console.warn(`[Banner] Failed to generate signed video URL for ${video.id}:`, error)
    }
  }

  return undefined
}

async function fetchDbVideosForBanner(
  config: UnifiedBannerConfig,
  rotationMode: BannerRotationMode
): Promise<DbBannerVideo[]> {
  await releaseDueVideos()
  const source = config.dbVideoSource || "manual"
  const poolLimit = Math.min(20, Math.max(1, config.dbVideoLimit || 6))
  const takeCount = rotationMode === "fixed" ? 1 : poolLimit
  const nowMs = Date.now()
  const oneWeekAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000)

  switch (source) {
    case "manual": {
      const ids = getNormalizedManualVideoIds(config)
      if (ids.length === 0) return []
      const fetched = await prisma.video.findMany({
        where: {
          id: { in: ids },
          status: "PUBLISHED",
        },
        select: bannerVideoSelect,
      })
      const ordered = ids
        .map((id) => fetched.find((v) => v.id === id))
        .filter((v): v is NonNullable<typeof v> => Boolean(v))
      return rotationMode === "fixed" ? ordered.slice(0, 1) : ordered
    }

    case "popular":
      return prisma.video.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { viewCount: "desc" },
        take: takeCount,
        select: bannerVideoSelect,
      })

    case "popular_weekly": {
      let videos = await prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          OR: [{ publishedAt: { gte: oneWeekAgo } }, { releaseDate: { gte: oneWeekAgo } }],
        },
        orderBy: { viewCount: "desc" },
        take: takeCount,
        select: bannerVideoSelect,
      })
      if (videos.length < takeCount) {
        const extra = await prisma.video.findMany({
          where: {
            status: "PUBLISHED",
            id: { notIn: videos.map((v) => v.id) },
          },
          orderBy: { viewCount: "desc" },
          take: takeCount - videos.length,
          select: bannerVideoSelect,
        })
        videos = [...videos, ...extra]
      }
      return videos
    }

    case "trending": {
      let videos = await prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { gte: oneWeekAgo },
        },
        orderBy: [{ viewCount: "desc" }, { likeCount: "desc" }],
        take: takeCount,
        select: bannerVideoSelect,
      })
      if (videos.length < takeCount) {
        const extra = await prisma.video.findMany({
          where: {
            status: "PUBLISHED",
            id: { notIn: videos.map((v) => v.id) },
          },
          orderBy: [{ publishedAt: "desc" }, { viewCount: "desc" }],
          take: takeCount - videos.length,
          select: bannerVideoSelect,
        })
        videos = [...videos, ...extra]
      }
      return videos
    }

    case "category": {
      if (!config.dbCategorySlug?.trim()) return []
      return prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          categories: {
            some: { category: { slug: config.dbCategorySlug.trim() } },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { releaseDate: "desc" }],
        take: takeCount,
        select: bannerVideoSelect,
      })
    }

    case "tag": {
      if (!config.dbTagSlug?.trim()) return []
      return prisma.video.findMany({
        where: {
          status: "PUBLISHED",
          tags: {
            some: { tag: { slug: config.dbTagSlug.trim() } },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { releaseDate: "desc" }],
        take: takeCount,
        select: bannerVideoSelect,
      })
    }

    case "latest":
    default:
      return prisma.video.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { releaseDate: "desc" }],
        take: takeCount,
        select: bannerVideoSelect,
      })
  }
}

function buildAutoVideoContent(video: DbBannerVideo, config: UnifiedBannerConfig, nowMs: number) {
  const firstCategory = video.categories[0]?.category?.name?.trim() || ""
  const performerNames = video.performers
    .map((p) => p.performer?.name?.trim())
    .filter(Boolean)
    .join(" & ")

  const isNew = isVideoNew(video, nowMs)
  const prefix = config.autoKickerPrefix?.trim() || (isNew ? "NEW SCENE" : "FEATURED SCENE")
  const kicker = firstCategory ? `${prefix} | ${firstCategory.toUpperCase()}` : prefix

  const title = performerNames || video.title
  const description = performerNames
    ? video.title
    : video.description
      ? video.description.slice(0, 160).trim()
      : ""

  return {
    kicker,
    title,
    description,
    buttonText: config.autoButtonText?.trim() || "WATCH NOW",
    buttonUrl: `/videos/${video.slug}`,
    openInNewTab: false,
  }
}

export interface ResolvedBannerResult {
  slides: ResolvedBannerSlide[]
  rotationMode: BannerRotationMode
  fullHeight: boolean
  height: number
  hasTextContent: boolean
}

export async function resolveBannerSection(
  rawConfig: Record<string, unknown> | null,
  sectionType: "HERO" | "CTA_BANNER"
): Promise<ResolvedBannerResult> {
  const config = (rawConfig || {}) as UnifiedBannerConfig
  const bgSource = getEffectiveBgSource(config, sectionType)
  const rotationMode: BannerRotationMode =
    bgSource === "dbVideo" ? config.rotationMode || "fixed" : "fixed"

  // Collect all internal pageIds to resolve in a single DB query
  const overrideEntries = Object.values(config.videoOverrides || {})
  const pageSlugMap = await resolvePageSlugMap([
    config.buttonPageId,
    config.linkPageId,
    ...overrideEntries.map((o) => o?.buttonPageId),
  ])

  const resolveLinkUrl = (
    linkType: "url" | "page" | undefined,
    url: string | null | undefined,
    pageId: string | null | undefined
  ): string | undefined => {
    if (linkType === "page" && pageId) {
      return pageSlugMap.get(pageId)
    }
    if (!linkType && pageId && pageSlugMap.has(pageId)) {
      return pageSlugMap.get(pageId)
    }
    return url?.trim() || undefined
  }

  const globalButtonUrl =
    resolveLinkUrl(config.buttonLinkType, config.buttonUrl, config.buttonPageId) ||
    resolveLinkUrl(config.linkType, config.linkUrl, config.linkPageId)

  const legacyHeroLinkUrl =
    sectionType === "HERO"
      ? resolveLinkUrl(config.linkType, config.linkUrl, config.linkPageId)
      : undefined

  const defaultOverlayColor = config.overlayColor || "#000000"
  const defaultBlurEnabled = Boolean(config.blurEnabled)
  const defaultBlurIntensity = config.blurIntensity ?? 4

  // Legacy HERO without any explicit text/overlay settings keeps clean image/video appearance
  const hasGlobalText = Boolean(
    config.kicker?.trim() || config.title?.trim() || config.description?.trim() || config.buttonText?.trim()
  )
  const defaultOverlayEnabled =
    config.overlayEnabled !== undefined
      ? Boolean(config.overlayEnabled)
      : sectionType === "HERO"
        ? hasGlobalText || bgSource === "dbVideo"
        : true

  const defaultOverlayOpacity = config.overlayOpacity

  const fullHeight =
    sectionType === "HERO"
      ? config.fullHeight !== undefined
        ? Boolean(config.fullHeight)
        : !config.height
      : false
  const height = config.height || (sectionType === "HERO" ? 720 : 486)

  // Case 1: DB Video background (manual 1..N or automatic pool)
  if (bgSource === "dbVideo") {
    const videos = await fetchDbVideosForBanner(config, rotationMode)
    const nowMs = Date.now()
    const isManualSource = !config.dbVideoSource || config.dbVideoSource === "manual"

    // Legacy single-video CTA configs saved custom title/buttonText/kicker directly on config without contentMode
    const legacySingleCustomContent =
      isManualSource &&
      !config.contentMode &&
      !config.videoOverrides &&
      Boolean(config.dbVideoId) &&
      hasGlobalText

    const globalContentMode =
      config.contentMode || (legacySingleCustomContent ? "custom" : "auto")

    if (videos.length > 0) {
      const slides: ResolvedBannerSlide[] = await Promise.all(
        videos.map(async (video) => {
          const mediaUrl = await resolveDbVideoMediaUrl(video)
          const override: BannerVideoItemOverride | undefined = isManualSource
            ? config.videoOverrides?.[video.id]
            : undefined

          const effectiveItemMode = override?.contentMode || (globalContentMode === "custom" ? "inherit" : "auto")

          let kicker: string | undefined
          let title = ""
          let description = ""
          let buttonText = ""
          let buttonUrl: string | undefined
          let openInNewTab = false

          if (effectiveItemMode === "custom" && override) {
            kicker = override.kicker?.trim() || undefined
            title = override.title?.trim() || ""
            description = override.description?.trim() || ""
            buttonText = override.buttonText?.trim() || ""
            buttonUrl = resolveLinkUrl(
              override.buttonLinkType,
              override.buttonUrl,
              override.buttonPageId
            )
            openInNewTab = Boolean(override.openInNewTab)
          } else if (effectiveItemMode === "inherit") {
            kicker =
              config.kicker?.trim() ||
              (config.dbVideoCategory
                ? `FEATURED SCENE | ${config.dbVideoCategory.toUpperCase()}`
                : undefined)
            title = config.title?.trim() || ""
            description = config.description?.trim() || ""
            buttonText = config.buttonText?.trim() || ""
            buttonUrl = globalButtonUrl
            openInNewTab = Boolean(config.openInNewTab)
          } else {
            const auto = buildAutoVideoContent(video, config, nowMs)
            kicker = auto.kicker
            title = auto.title
            description = auto.description
            buttonText = auto.buttonText
            buttonUrl = auto.buttonUrl
            openInNewTab = auto.openInNewTab
          }

          const useCustomEffects = Boolean(override?.customEffects)
          const overlayEnabled = useCustomEffects
            ? override?.overlayEnabled ?? defaultOverlayEnabled
            : defaultOverlayEnabled
          const overlayOpacity = useCustomEffects
            ? override?.overlayOpacity ?? defaultOverlayOpacity
            : defaultOverlayOpacity
          const overlayColor = useCustomEffects
            ? override?.overlayColor || defaultOverlayColor
            : defaultOverlayColor
          const blurEnabled = useCustomEffects
            ? override?.blurEnabled ?? defaultBlurEnabled
            : defaultBlurEnabled
          const blurIntensity = useCustomEffects
            ? override?.blurIntensity ?? defaultBlurIntensity
            : defaultBlurIntensity

          return {
            id: video.id,
            kicker,
            title,
            description,
            buttonText,
            buttonUrl,
            openInNewTab,
            fullBannerLinkUrl: !buttonText ? legacyHeroLinkUrl : undefined,
            backgroundImage: video.thumbnailUrl || config.backgroundImage || undefined,
            videoUrl: mediaUrl,
            overlayEnabled,
            overlayOpacity,
            overlayColor,
            blurEnabled,
            blurIntensity,
          }
        })
      )

      return {
        slides,
        rotationMode,
        fullHeight,
        height,
        hasTextContent: slides.some((s) => Boolean(s.kicker || s.title || s.description || s.buttonText)),
      }
    }
  }

  // Case 2: Image or Uploaded Video (or fallback when dbVideo pool is empty)
  const fallbackBgImage =
    bgSource === "image"
      ? config.backgroundImage?.trim() || (sectionType === "HERO" ? "/images/background.png" : undefined)
      : config.backgroundImage?.trim() || config.dbVideoThumbnail?.trim() || undefined

  const uploadedVideoUrl =
    bgSource === "uploadedVideo" ? config.videoUrl?.trim() || undefined : undefined

  const defaultButtonText =
    sectionType === "CTA_BANNER"
      ? config.buttonText !== undefined
        ? config.buttonText
        : "See more"
      : config.buttonText || ""

  const singleSlide: ResolvedBannerSlide = {
    id: "static",
    kicker: config.kicker?.trim() || undefined,
    title: config.title?.trim() || "",
    description: config.description?.trim() || "",
    buttonText: defaultButtonText.trim(),
    buttonUrl: globalButtonUrl,
    openInNewTab: Boolean(config.openInNewTab),
    fullBannerLinkUrl: !defaultButtonText.trim() ? legacyHeroLinkUrl : undefined,
    backgroundImage: fallbackBgImage,
    videoUrl: uploadedVideoUrl,
    overlayEnabled: defaultOverlayEnabled,
    overlayOpacity: defaultOverlayOpacity,
    overlayColor: defaultOverlayColor,
    blurEnabled: defaultBlurEnabled,
    blurIntensity: defaultBlurIntensity,
  }

  return {
    slides: [singleSlide],
    rotationMode: "fixed",
    fullHeight,
    height,
    hasTextContent: Boolean(
      singleSlide.kicker || singleSlide.title || singleSlide.description || singleSlide.buttonText
    ),
  }
}
