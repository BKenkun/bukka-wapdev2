import { HomeSectionType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { SectionHeader } from "@/components/section-header"
import { VideoGrid } from "@/components/video-grid"
import { VideoCarousel } from "@/components/video-carousel"
import { CtaBanner } from "@/components/cta-banner"
import { ActressesCarousel } from "@/components/actresses-carousel"
import { CountdownTimer } from "@/components/countdown-timer"
import { getVideoToken, getVideoPreviewUrl, isMuxSigningConfigured } from "@/lib/mux/client"
import { releaseDuePerformers } from "@/lib/performer-release"
import { isPerformerNew, isPerformerScheduled } from "@/lib/performer-status"
import { releaseDueVideos } from "@/lib/video-release"
import {
  getPublicVideoPoolWhere,
  getUpcomingWindowVideosWhere,
  isVideoNew,
  isVideoScheduled,
} from "@/lib/video-status"
import { resolveUpcomingScene, type CountdownSectionConfig } from "@/lib/upcoming-scene"
import { resolveBannerSection } from "@/lib/banner-resolver"
import type { UnifiedBannerConfig } from "@/lib/banner-config"

interface HomeSection {
  id: string
  type: HomeSectionType
  title: string | null
  enabled: boolean
  order: number
  config: Record<string, unknown> | null
}

interface HomeSectionRendererProps {
  section: HomeSection
}

interface VideoGridConfig {
  source?: string
  categorySlug?: string
  tagSlug?: string
  videoIds?: string[]
  limit?: number
  columns?: 2 | 3 | 4
  displayMode?: "carousel" | "grid"
}

interface ActressGridConfig {
  source?: string
  performerIds?: string[]
  limit?: number
}



interface Performer {
  name: string
  slug: string
}

interface VideoData {
  id: string
  slug: string
  title: string
  subtitle?: string
  views: string
  likes?: string
  imageUrl: string
  previewUrl?: string
  previewStartTime?: number
  previewEndTime?: number
  isVerified: boolean
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
}

async function getVideosForSection(config: VideoGridConfig): Promise<VideoData[]> {
  const limit = config.limit || 6

  try {
    await releaseDueVideos()
    const now = new Date()
    const nowMs = now.getTime()

    let videos: Array<{
      id: string
      slug: string
      title: string
      thumbnailUrl: string
      previewUrl: string | null
      previewStartTime: number
      previewEndTime: number
      muxPlaybackId: string | null
      viewCount: number
      likeCount: number
      status: string
      publishedAt: Date | null
      releaseDate: Date | null
      minTierPlan: { level: number } | null
      isDiamondExclusive: boolean
      isLimitedEdition: boolean
      limitedAccessUntil: Date | null
      performers: Array<{ performer: { name: string; slug: string } }>
      categories: Array<{ category: { name: string } }>
    }>

    const videoSelect = {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      previewUrl: true,
      previewStartTime: true,
      previewEndTime: true,
      muxPlaybackId: true,
      viewCount: true,
      likeCount: true,
      status: true,
      publishedAt: true,
      releaseDate: true,
      minTierPlan: { select: { level: true } },
      isDiamondExclusive: true,
      isLimitedEdition: true,
      limitedAccessUntil: true,
      performers: { include: { performer: { select: { name: true, slug: true } } } },
      categories: { include: { category: { select: { name: true } } }, take: 1 },
    }

    // Calculate date for weekly filtering
    const oneWeekAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000)

    switch (config.source) {
      case "popular":
        videos = await prisma.video.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { viewCount: "desc" },
          take: limit,
          select: videoSelect,
        })
        break

      case "popular_weekly":
        // Most viewed in the last 7 days
        videos = await prisma.video.findMany({
          where: {
            status: "PUBLISHED",
            OR: [
              { publishedAt: { gte: oneWeekAgo } },
              { releaseDate: { gte: oneWeekAgo } },
            ],
          },
          orderBy: { viewCount: "desc" },
          take: limit,
          select: videoSelect,
        })
        // If not enough recent videos, fill with all-time popular
        if (videos.length < limit) {
          const additionalVideos = await prisma.video.findMany({
            where: {
              status: "PUBLISHED",
              id: { notIn: videos.map((v) => v.id) },
            },
            orderBy: { viewCount: "desc" },
            take: limit - videos.length,
            select: videoSelect,
          })
          videos = [...videos, ...additionalVideos]
        }
        break

      case "trending":
        // Trending: Recently published with good engagement
        // Prioritize newer videos with higher view counts
        videos = await prisma.video.findMany({
          where: {
            status: "PUBLISHED",
            publishedAt: { gte: oneWeekAgo },
          },
          orderBy: [
            { viewCount: "desc" },
            { likeCount: "desc" },
          ],
          take: limit,
          select: videoSelect,
        })
        // If not enough trending, fill with recent popular
        if (videos.length < limit) {
          const additionalVideos = await prisma.video.findMany({
            where: {
              status: "PUBLISHED",
              id: { notIn: videos.map((v) => v.id) },
            },
            orderBy: [
              { publishedAt: "desc" },
              { viewCount: "desc" },
            ],
            take: limit - videos.length,
            select: videoSelect,
          })
          videos = [...videos, ...additionalVideos]
        }
        break

      case "category":
        if (config.categorySlug) {
          videos = await prisma.video.findMany({
            where: {
              AND: [getPublicVideoPoolWhere(now)],
              categories: {
                some: {
                  category: { slug: config.categorySlug },
                },
              },
            },
            orderBy: { releaseDate: "desc" },
            take: limit,
            select: videoSelect,
          })
        } else {
          videos = []
        }
        break

      case "tag":
        if (config.tagSlug) {
          videos = await prisma.video.findMany({
            where: {
              AND: [getPublicVideoPoolWhere(now)],
              tags: {
                some: {
                  tag: { slug: config.tagSlug },
                },
              },
            },
            orderBy: { releaseDate: "desc" },
            take: limit,
            select: videoSelect,
          })
        } else {
          videos = []
        }
        break

      case "manual":
        if (config.videoIds && config.videoIds.length > 0) {
          const fetchedVideos = await prisma.video.findMany({
            where: {
              id: { in: config.videoIds },
              status: { in: ["PUBLISHED", "SCHEDULED"] },
            },
            select: videoSelect,
          })
          // Maintain the order specified in config.videoIds
          videos = config.videoIds
            .map((id: string) => fetchedVideos.find((v) => v.id === id))
            .filter((v): v is NonNullable<typeof v> => v !== undefined)
        } else {
          videos = []
        }
        break

      case "latest":
      default: {
        // Show upcoming scenes dropping within the next 10 days (soonest first), followed by latest published
        const upcomingVideos = await prisma.video.findMany({
          where: getUpcomingWindowVideosWhere(now),
          orderBy: { releaseDate: "asc" },
          take: limit,
          select: videoSelect,
        })
        const remaining = Math.max(0, limit - upcomingVideos.length)
        const publishedVideos =
          remaining > 0
            ? await prisma.video.findMany({
                where: { status: "PUBLISHED" },
                orderBy: [{ publishedAt: "desc" }, { releaseDate: "desc" }],
                take: remaining,
                select: videoSelect,
              })
            : []
        videos = [...upcomingVideos, ...publishedVideos]
        break
      }
    }

    // Transform to VideoGrid format with signed preview URLs (skip previews for scheduled videos)
    return Promise.all(
      videos.map(async (video) => {
        const scheduled = isVideoScheduled(video, nowMs)
        let videoPreviewUrl: string | undefined = undefined

        if (!scheduled) {
          // Use custom previewUrl if available, otherwise use signed Mux MP4
          videoPreviewUrl = video.previewUrl || undefined

          if (!videoPreviewUrl && video.muxPlaybackId && isMuxSigningConfigured()) {
            try {
              // Generate signed token for Mux MP4 preview (capped-1080p matches createMuxUpload)
              const token = await getVideoToken(video.muxPlaybackId)
              videoPreviewUrl = getVideoPreviewUrl(video.muxPlaybackId, token, "capped-1080p")
            } catch (error) {
              console.warn(`Failed to generate preview token for video ${video.id}:`, error)
              // Fallback: leave previewUrl undefined
            }
          }
        }

        return {
          id: video.id,
          slug: video.slug,
          title: video.title,
          views: formatViews(video.viewCount),
          imageUrl: video.thumbnailUrl || "/images/placeholder-video.jpg",
          previewUrl: videoPreviewUrl,
          previewStartTime: video.previewStartTime,
          previewEndTime: video.previewEndTime,
          isVerified: true,
          category: video.categories[0]?.category.name,
          performers: video.performers.map((p) => ({ name: p.performer.name, slug: p.performer.slug })),
          publishedAt: video.releaseDate || undefined,
          comingSoon: scheduled,
          releaseDate: video.releaseDate?.toISOString() ?? null,
          isNew: isVideoNew(video, nowMs),
          minTierLevel: video.minTierPlan?.level ?? 0,
          isDiamondExclusive: video.isDiamondExclusive,
          isLimitedEdition: video.isLimitedEdition,
          limitedAccessUntil: video.limitedAccessUntil?.toISOString() ?? null,
        }
      })
    )
  } catch (error) {
    console.error("Error fetching videos for section:", error)
    return []
  }
}

interface PerformerData {
  id: string
  slug?: string
  name: string
  imageUrl: string
  videoCount?: number
  totalViews?: number
  verified?: boolean
  comingSoon?: boolean
  comingSoonDate?: string | null
  releasedAt?: string | null
  isNew?: boolean
}

async function getPerformersForSection(config: ActressGridConfig): Promise<PerformerData[]> {
  const limit = config.limit || 10

  try {
    await releaseDuePerformers()
    const nowMs = Date.now()

    let performers: Array<{
      id: string
      slug: string
      name: string
      profileImage: string | null
      verified: boolean
      comingSoon: boolean
      comingSoonDate: Date | null
      releasedAt: Date | null
      _count: { VideoPerformer: number }
      VideoPerformer: Array<{ video: { viewCount: number } }>
    }>

    const performerSelect = {
      id: true,
      slug: true,
      name: true,
      profileImage: true,
      verified: true,
      comingSoon: true,
      comingSoonDate: true,
      releasedAt: true,
      _count: { select: { VideoPerformer: true } },
      VideoPerformer: {
        select: {
          video: {
            select: { viewCount: true },
          },
        },
      },
    }

    switch (config.source) {
      case "manual":
        if (config.performerIds && config.performerIds.length > 0) {
          performers = await prisma.performer.findMany({
            where: { id: { in: config.performerIds } },
            select: performerSelect,
          })
        } else {
          performers = []
        }
        break

      case "popular":
      case "featured":
      case "latest":
      default:
        performers = await prisma.performer.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: performerSelect,
        })
        break
    }

    // Transform to ActressesGrid format
    return performers.map((performer) => ({
      id: performer.id,
      slug: performer.slug,
      name: performer.name,
      imageUrl: performer.profileImage || "/images/placeholder-performer.jpg",
      videoCount: performer._count.VideoPerformer,
      totalViews: performer.VideoPerformer.reduce((sum, vp) => sum + vp.video.viewCount, 0),
      verified: performer.verified,
      comingSoon: isPerformerScheduled(performer, nowMs),
      comingSoonDate: performer.comingSoonDate?.toISOString() || null,
      releasedAt: performer.releasedAt?.toISOString() || null,
      isNew: isPerformerNew(performer, nowMs),
    }))
  } catch (error) {
    console.error("Error fetching performers for section:", error)
    return []
  }
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(0)}K`
  }
  return views.toString()
}

function calculateLikePercentage(likes: number, views: number): string {
  if (views === 0) return "98%"
  const percentage = Math.min(99, Math.max(50, Math.round((likes / views) * 100 + 80)))
  return `${percentage}%`
}

export async function HomeSectionRenderer({ section }: HomeSectionRendererProps) {
  const config = section.config || {}

  switch (section.type) {
    case "HERO": {
      const bannerConfig = config as UnifiedBannerConfig
      const resolved = await resolveBannerSection(config, "HERO")

      return (
        <CtaBanner
          slides={resolved.slides}
          rotationMode={resolved.rotationMode}
          sectionId={section.id}
          fullHeight={resolved.fullHeight}
          height={resolved.height}
          headingTag="h1"
          titleFontFamily={bannerConfig.titleFontFamily}
          titleFontSize={bannerConfig.titleFontSize}
          buttonBgColor={bannerConfig.buttonBgColor}
          buttonHoverColor={bannerConfig.buttonHoverColor}
          buttonTextColor={bannerConfig.buttonTextColor}
          buttonHoverTextColor={bannerConfig.buttonHoverTextColor}
          contentPosition={bannerConfig.contentPosition}
        />
      )
    }

    case "VIDEO_GRID": {
      const videoConfig = config as VideoGridConfig
      const videos = await getVideosForSection(videoConfig)

      return (
        <>
          {section.title && <SectionHeader title={section.title} />}
          {videoConfig.displayMode === "grid" ? (
            <div className="px-4 md:px-8 py-6">
              <VideoGrid
                videos={videos.length > 0 ? videos : undefined}
                columns={videoConfig.columns || 3}
              />
            </div>
          ) : (
            <VideoCarousel videos={videos.length > 0 ? videos : undefined} />
          )}
        </>
      )
    }

    case "ACTRESS_GRID": {
      const actressConfig = config as ActressGridConfig
      const performers = await getPerformersForSection(actressConfig)

      if (performers.length === 0) return null

      return (
        <>
          {section.title && <SectionHeader title={section.title} />}
          <ActressesCarousel actresses={performers} />
        </>
      )
    }

    case "CTA_BANNER": {
      const bannerConfig = config as UnifiedBannerConfig
      const resolved = await resolveBannerSection(config, "CTA_BANNER")

      return (
        <CtaBanner
          slides={resolved.slides}
          rotationMode={resolved.rotationMode}
          sectionId={section.id}
          fullHeight={resolved.fullHeight}
          height={resolved.height}
          headingTag="h2"
          titleFontFamily={bannerConfig.titleFontFamily}
          titleFontSize={bannerConfig.titleFontSize}
          buttonBgColor={bannerConfig.buttonBgColor}
          buttonHoverColor={bannerConfig.buttonHoverColor}
          buttonTextColor={bannerConfig.buttonTextColor}
          buttonHoverTextColor={bannerConfig.buttonHoverTextColor}
          contentPosition={bannerConfig.contentPosition}
        />
      )
    }

    case "COUNTDOWN": {
      const countdownConfig = config as CountdownSectionConfig
      const resolved = await resolveUpcomingScene(countdownConfig)

      return (
        <CountdownTimer
          resolved={resolved}
          height={countdownConfig.height}
          contentPosition={countdownConfig.contentPosition}
          overlayEnabled={countdownConfig.overlayEnabled}
          overlayOpacity={countdownConfig.overlayOpacity}
          overlayColor={countdownConfig.overlayColor}
          blurEnabled={countdownConfig.blurEnabled}
          blurIntensity={countdownConfig.blurIntensity}
          titleFontFamily={countdownConfig.titleFontFamily}
          titleFontSize={countdownConfig.titleFontSize}
          buttonBgColor={countdownConfig.buttonBgColor}
          buttonHoverColor={countdownConfig.buttonHoverColor}
          buttonTextColor={countdownConfig.buttonTextColor}
          buttonHoverTextColor={countdownConfig.buttonHoverTextColor}
        />
      )
    }

    case "CATEGORY_FEATURED": {
      const categoryConfig = config as VideoGridConfig
      const videos = await getVideosForSection({
        source: "category",
        categorySlug: categoryConfig.categorySlug,
        limit: categoryConfig.limit || 6,
      })

      return (
        <>
          {section.title && <SectionHeader title={section.title} />}
          {categoryConfig.displayMode === "carousel" ? (
            <VideoCarousel videos={videos.length > 0 ? videos : undefined} />
          ) : (
            <VideoGrid
              videos={videos.length > 0 ? videos : undefined}
              columns={categoryConfig.columns || 3}
            />
          )}
        </>
      )
    }

    default:
      console.warn(`Unknown section type: ${section.type}`)
      return null
  }
}
