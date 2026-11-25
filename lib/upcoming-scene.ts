import { prisma } from "@/lib/prisma"
import { getVideoToken, getVideoPreviewUrl } from "@/lib/mux/client"
import { releaseDueVideos } from "@/lib/video-release"
import {
  BannerContentPosition,
  parseTargetDateToIso,
  sanitizeBannerUrl,
} from "@/lib/banner-utils"

export type UpcomingSceneMode = "auto" | "manual"
export type ManualStateCAction = "auto" | "keep_b" | "custom"
export type UpcomingScenePhase = "countdown" | "new_release" | "fallback"

export interface CountdownSectionConfig {
  mode?: UpcomingSceneMode

  // Auto mode configuration
  videoId?: string | null
  videoTitle?: string | null
  videoSlug?: string | null
  videoThumbnail?: string | null
  videoReleaseDate?: string | null
  videoPerformers?: string | null
  videoCategory?: string | null
  newReleaseWindowDays?: number
  autoStateAKicker?: string
  autoStateBKicker?: string
  autoStateCKicker?: string
  autoNotifyButtonText?: string
  autoNotifiedButtonText?: string
  autoWatchButtonText?: string

  // Manual mode — State A (Countdown)
  targetDate?: string
  kicker?: string
  title?: string
  subtitle?: string
  stateAButtonText?: string
  stateAButtonUrl?: string

  // Manual mode — State B (Just released / Post-countdown)
  stateBKicker?: string
  stateBTitle?: string
  stateBSubtitle?: string
  stateBButtonText?: string
  stateBButtonUrl?: string
  stateBBackgroundImage?: string
  stateBVideoUrl?: string
  stateBDurationDays?: number

  // Manual mode — State C (After State B window expires)
  manualStateCAction?: ManualStateCAction
  stateCKicker?: string
  stateCTitle?: string
  stateCSubtitle?: string
  stateCButtonText?: string
  stateCButtonUrl?: string
  stateCBackgroundImage?: string
  stateCVideoUrl?: string
  stateCTargetDate?: string

  // Shared background & visual styling
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

export interface UpcomingSceneSlide {
  kicker: string
  title: string
  subtitle?: string
  buttonText?: string
  buttonUrl?: string
  backgroundImage?: string
  videoUrl?: string
  targetDateIso?: string | null
  /** Present when tied to a database video (enables Notify Me & auto-release) */
  videoId?: string | null
  videoSlug?: string | null
  enableNotifyMe?: boolean
  notifyButtonText?: string
  notifiedButtonText?: string
}

export interface ResolvedUpcomingScene {
  mode: UpcomingSceneMode
  initialPhase: UpcomingScenePhase
  stateA: UpcomingSceneSlide
  stateB: UpcomingSceneSlide
  stateC: UpcomingSceneSlide | null
  /** ISO timestamp when State A transitions to State B */
  targetDateIso: string | null
  /** ISO timestamp when State B transitions to State C (null = keep State B indefinitely) */
  stateBEndsAtIso: string | null
  manualStateCAction: ManualStateCAction
  /** True when hitting 0 should ping /api/videos/release */
  triggerVideoReleaseOnEnd: boolean
}

const VIDEO_SELECT = {
  id: true,
  slug: true,
  title: true,
  thumbnailUrl: true,
  previewUrl: true,
  muxPlaybackId: true,
  status: true,
  releaseDate: true,
  publishedAt: true,
  performers: {
    include: {
      performer: {
        select: { name: true, slug: true },
      },
    },
  },
  categories: {
    include: {
      category: {
        select: { name: true, slug: true },
      },
    },
    take: 1,
  },
} as const

type SelectedVideoRow = {
  id: string
  slug: string
  title: string
  thumbnailUrl: string
  previewUrl: string | null
  muxPlaybackId: string | null
  status: string
  releaseDate: Date
  publishedAt: Date | null
  performers: Array<{ performer: { name: string; slug: string } }>
  categories: Array<{ category: { name: string; slug: string } }>
}

function buildKicker(label: string, category?: string | null): string {
  const cleanLabel = label.trim().toUpperCase()
  const cleanCategory = category?.trim().toUpperCase()
  if (cleanCategory) {
    return `${cleanLabel} | ${cleanCategory}`
  }
  return cleanLabel
}

async function resolveVideoBackground(
  video: SelectedVideoRow,
  overrideImage?: string,
  overrideVideo?: string
): Promise<{ backgroundImage?: string; videoUrl?: string }> {
  const customVideo = overrideVideo?.trim() || undefined
  const customImage = overrideImage?.trim() || undefined

  if (customVideo) {
    return {
      videoUrl: customVideo,
      backgroundImage: customImage || video.thumbnailUrl || "/images/background.png",
    }
  }

  let resolvedVideoUrl: string | undefined = video.previewUrl?.trim() || undefined

  if (!resolvedVideoUrl && video.muxPlaybackId) {
    try {
      const token = await getVideoToken(video.muxPlaybackId)
      resolvedVideoUrl = getVideoPreviewUrl(video.muxPlaybackId, token, "high")
    } catch (error) {
      console.warn(`Failed to sign Mux preview for Upcoming Scene video ${video.id}:`, error)
    }
  }

  return {
    videoUrl: resolvedVideoUrl,
    backgroundImage: customImage || video.thumbnailUrl || "/images/background.png",
  }
}

async function buildAutoResolutionFromVideo(
  video: SelectedVideoRow,
  config: CountdownSectionConfig,
  nowMs: number,
  isCatalogFallback: boolean
): Promise<ResolvedUpcomingScene> {
  const windowDays = Math.max(1, Number(config.newReleaseWindowDays) || 4)
  const windowMs = windowDays * 24 * 60 * 60 * 1000

  const categoryName = video.categories[0]?.category?.name || null
  const performerNames = video.performers
    .map((p) => p.performer?.name)
    .filter(Boolean)
    .join(" & ")

  const headline = performerNames || video.title
  const sceneSubtitle = performerNames ? video.title : ""

  const stateALabel = config.autoStateAKicker?.trim() || "UPCOMING SCENE"
  const stateBLabel = config.autoStateBKicker?.trim() || "NEW SCENE"
  const stateCLabel = config.autoStateCKicker?.trim() || "LATEST RELEASE"
  const notifyText = config.autoNotifyButtonText?.trim() || "NOTIFY ME"
  const notifiedText = config.autoNotifiedButtonText?.trim() || "NOTIFIED"
  const watchText = config.autoWatchButtonText?.trim() || "WATCH NOW"

  const media = await resolveVideoBackground(video, config.backgroundImage, config.videoUrl)

  const releaseMs = new Date(video.releaseDate).getTime()
  const releaseIso = new Date(releaseMs).toISOString()
  const stateBEndsAtIso = new Date(releaseMs + windowMs).toISOString()

  const stateA: UpcomingSceneSlide = {
    kicker: buildKicker(stateALabel, categoryName),
    title: headline,
    subtitle: sceneSubtitle,
    backgroundImage: media.backgroundImage,
    videoUrl: media.videoUrl,
    targetDateIso: releaseIso,
    videoId: video.id,
    videoSlug: video.slug,
    enableNotifyMe: true,
    notifyButtonText: notifyText,
    notifiedButtonText: notifiedText,
  }

  const stateB: UpcomingSceneSlide = {
    kicker: buildKicker(stateBLabel, categoryName),
    title: headline,
    subtitle: sceneSubtitle,
    buttonText: watchText,
    buttonUrl: `/videos/${video.slug}`,
    backgroundImage: media.backgroundImage,
    videoUrl: media.videoUrl,
    videoId: video.id,
    videoSlug: video.slug,
    enableNotifyMe: false,
  }

  const stateC: UpcomingSceneSlide = {
    kicker: buildKicker(stateCLabel, categoryName),
    title: headline,
    subtitle: sceneSubtitle,
    buttonText: watchText,
    buttonUrl: `/videos/${video.slug}`,
    backgroundImage: media.backgroundImage,
    videoUrl: media.videoUrl,
    videoId: video.id,
    videoSlug: video.slug,
    enableNotifyMe: false,
  }

  let initialPhase: UpcomingScenePhase = "fallback"
  if (isCatalogFallback) {
    initialPhase = "fallback"
  } else if (releaseMs > nowMs) {
    initialPhase = "countdown"
  } else if (nowMs - releaseMs <= windowMs) {
    initialPhase = "new_release"
  } else {
    initialPhase = "fallback"
  }

  return {
    mode: "auto",
    initialPhase,
    stateA,
    stateB,
    stateC,
    targetDateIso: releaseIso,
    stateBEndsAtIso,
    manualStateCAction: "auto",
    triggerVideoReleaseOnEnd: true,
  }
}

async function resolveAutoUpcomingScene(
  config: CountdownSectionConfig,
  now: Date
): Promise<ResolvedUpcomingScene> {
  const nowMs = now.getTime()
  const windowDays = Math.max(1, Number(config.newReleaseWindowDays) || 4)
  const windowMs = windowDays * 24 * 60 * 60 * 1000

  try {
    // 1. Check explicitly selected video in admin
    if (config.videoId) {
      const selected = await prisma.video.findFirst({
        where: {
          id: config.videoId,
          status: { in: ["SCHEDULED", "PUBLISHED"] },
        },
        select: VIDEO_SELECT,
      })

      if (selected) {
        const releaseMs = new Date(selected.releaseDate).getTime()
        const isFuture = releaseMs > nowMs
        const isWithinNewWindow = releaseMs <= nowMs && nowMs - releaseMs <= windowMs

        if (isFuture || isWithinNewWindow) {
          return buildAutoResolutionFromVideo(selected, config, nowMs, false)
        }
        // Otherwise > windowDays old -> proceed to State C fallback!
      }
    }

    // 2. State C Fallback — Step 1: Nearest upcoming scheduled/future video
    const nearestUpcoming = await prisma.video.findFirst({
      where: {
        status: { in: ["SCHEDULED", "PUBLISHED"] },
        releaseDate: { gt: now },
      },
      orderBy: { releaseDate: "asc" },
      select: VIDEO_SELECT,
    })

    if (nearestUpcoming) {
      return buildAutoResolutionFromVideo(nearestUpcoming, config, nowMs, false)
    }

    // 3. State C Fallback — Step 2: Recently released published video within window
    const windowCutoff = new Date(nowMs - windowMs)
    const recentRelease = await prisma.video.findFirst({
      where: {
        status: "PUBLISHED",
        releaseDate: { lte: now, gte: windowCutoff },
      },
      orderBy: { releaseDate: "desc" },
      select: VIDEO_SELECT,
    })

    if (recentRelease) {
      return buildAutoResolutionFromVideo(recentRelease, config, nowMs, false)
    }

    // 4. State C Fallback — Step 3: Latest published video in general catalog ("LATEST RELEASE")
    const latestPublished = await prisma.video.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: [{ releaseDate: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      select: VIDEO_SELECT,
    })

    if (latestPublished) {
      return buildAutoResolutionFromVideo(latestPublished, config, nowMs, true)
    }
  } catch (error) {
    console.error("Error resolving auto Upcoming Scene:", error)
  }

  // Graceful empty-catalog fallback (e.g. fresh DB or mock preview)
  const fallbackSlide: UpcomingSceneSlide = {
    kicker: buildKicker(config.autoStateCKicker || "LATEST RELEASE", "EXCLUSIVE"),
    title: config.title?.trim() || "NEW SCENES EVERY WEEK",
    subtitle: config.subtitle?.trim() || "Explore our latest releases now",
    buttonText: config.autoWatchButtonText?.trim() || "WATCH NOW",
    buttonUrl: "/videos",
    backgroundImage: config.backgroundImage?.trim() || "/images/background.png",
    videoUrl: config.videoUrl?.trim() || undefined,
    enableNotifyMe: false,
  }

  return {
    mode: "auto",
    initialPhase: "fallback",
    stateA: fallbackSlide,
    stateB: fallbackSlide,
    stateC: fallbackSlide,
    targetDateIso: null,
    stateBEndsAtIso: null,
    manualStateCAction: "auto",
    triggerVideoReleaseOnEnd: false,
  }
}

export async function resolveUpcomingScene(
  config: CountdownSectionConfig
): Promise<ResolvedUpcomingScene> {
  // Ensure any due scheduled videos are released before evaluating states
  await releaseDueVideos()

  const now = new Date()
  const nowMs = now.getTime()

  // Preserve backwards compatibility: if mode isn't explicitly set,
  // use "auto" if a videoId is set, or "manual" if a legacy targetDate is configured, else "auto".
  const mode: UpcomingSceneMode =
    config.mode || (config.videoId ? "auto" : config.targetDate ? "manual" : "auto")

  if (mode === "auto") {
    return resolveAutoUpcomingScene(config, now)
  }

  // Manual mode
  const targetDateIso = parseTargetDateToIso(config.targetDate)
  const targetMs = targetDateIso ? new Date(targetDateIso).getTime() : null

  const stateBDurationDays = Math.max(0, Number(config.stateBDurationDays ?? 4))
  const manualStateCAction: ManualStateCAction = config.manualStateCAction || "auto"

  const stateBEndsAtIso =
    targetMs !== null && manualStateCAction !== "keep_b"
      ? new Date(targetMs + stateBDurationDays * 24 * 60 * 60 * 1000).toISOString()
      : null

  const baseBgImage = config.backgroundImage?.trim() || "/images/background.png"
  const baseVideoUrl = config.videoUrl?.trim() || undefined

  const stateA: UpcomingSceneSlide = {
    kicker: config.kicker?.trim() || "UPCOMING SCENE",
    title: config.title?.trim() || "NEXT RELEASE",
    subtitle: config.subtitle?.trim() || "",
    buttonText: config.stateAButtonText?.trim() || undefined,
    buttonUrl: sanitizeBannerUrl(config.stateAButtonUrl),
    backgroundImage: baseBgImage,
    videoUrl: baseVideoUrl,
    targetDateIso,
    enableNotifyMe: false,
  }

  const stateB: UpcomingSceneSlide = {
    kicker: config.stateBKicker?.trim() || "NEW SCENE | OUT NOW",
    title: config.stateBTitle?.trim() || config.title?.trim() || "NEW RELEASE",
    subtitle: config.stateBSubtitle?.trim() || config.subtitle?.trim() || "",
    buttonText: config.stateBButtonText?.trim() || "WATCH NOW",
    buttonUrl: sanitizeBannerUrl(config.stateBButtonUrl) || "/videos",
    backgroundImage: config.stateBBackgroundImage?.trim() || baseBgImage,
    videoUrl: config.stateBVideoUrl?.trim() || baseVideoUrl,
    enableNotifyMe: false,
  }

  let stateC: UpcomingSceneSlide | null = null
  let autoStateCResolution: ResolvedUpcomingScene | null = null

  if (manualStateCAction === "auto") {
    autoStateCResolution = await resolveAutoUpcomingScene(config, now)
    if (autoStateCResolution.initialPhase === "countdown") {
      stateC = autoStateCResolution.stateA
    } else if (autoStateCResolution.initialPhase === "new_release") {
      stateC = autoStateCResolution.stateB
    } else {
      stateC = autoStateCResolution.stateC || autoStateCResolution.stateB
    }
  } else if (manualStateCAction === "custom") {
    const customTargetIso = parseTargetDateToIso(config.stateCTargetDate)
    stateC = {
      kicker: config.stateCKicker?.trim() || "LATEST RELEASE",
      title: config.stateCTitle?.trim() || config.stateBTitle?.trim() || config.title?.trim() || "EXCLUSIVE",
      subtitle: config.stateCSubtitle?.trim() || "",
      buttonText: config.stateCButtonText?.trim() || "WATCH NOW",
      buttonUrl: sanitizeBannerUrl(config.stateCButtonUrl) || "/videos",
      backgroundImage: config.stateCBackgroundImage?.trim() || baseBgImage,
      videoUrl: config.stateCVideoUrl?.trim() || baseVideoUrl,
      targetDateIso: customTargetIso,
      enableNotifyMe: false,
    }
  }

  let initialPhase: UpcomingScenePhase = "countdown"
  if (targetMs === null) {
    initialPhase = "new_release"
  } else if (targetMs > nowMs) {
    initialPhase = "countdown"
  } else if (
    manualStateCAction === "keep_b" ||
    !stateBEndsAtIso ||
    nowMs <= new Date(stateBEndsAtIso).getTime()
  ) {
    initialPhase = "new_release"
  } else {
    // State B expired -> enter State C
    if (manualStateCAction === "auto" && autoStateCResolution) {
      return autoStateCResolution
    }
    initialPhase = "fallback"
  }

  return {
    mode: "manual",
    initialPhase,
    stateA,
    stateB,
    stateC,
    targetDateIso,
    stateBEndsAtIso,
    manualStateCAction,
    triggerVideoReleaseOnEnd: false,
  }
}
