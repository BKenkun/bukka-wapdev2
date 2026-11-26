import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getPublicVideoPoolWhere, isVideoNew, isVideoScheduled } from "@/lib/video-status"

export const PERFORMER_PAGE_VIDEO_SELECT = {
  id: true,
  slug: true,
  title: true,
  thumbnailUrl: true,
  previewUrl: true,
  duration: true,
  viewCount: true,
  likeCount: true,
  muxPlaybackId: true,
  previewStartTime: true,
  previewEndTime: true,
  status: true,
  publishedAt: true,
  releaseDate: true,
  minTierPlan: { select: { level: true } },
  isDiamondExclusive: true,
  isLimitedEdition: true,
  limitedAccessUntil: true,
  categories: {
    include: {
      category: {
        select: { id: true, name: true },
      },
    },
  },
  tags: {
    select: {
      tagId: true,
    },
  },
  performers: {
    include: {
      performer: {
        select: { id: true, name: true, slug: true, verified: true },
      },
    },
  },
} satisfies Prisma.VideoSelect

export type PerformerPageVideoRecord = Prisma.VideoGetPayload<{
  select: typeof PERFORMER_PAGE_VIDEO_SELECT
}>

interface GetDynamicRelatedVideosParams {
  performerId: string
  ownVideos: PerformerPageVideoRecord[]
  excludeVideoIds: string[]
  limit: number
  now?: Date
}

/**
 * Dynamically selects related videos for a performer profile using multi-signal affinity
 * (shared co-performers, shared categories, shared tags, similar views/likes, recency)
 * combined with weighted probabilistic sampling (Efraimidis-Spirakis) so revisits feel fresh
 * while keeping recommendations highly relevant.
 */
export async function getDynamicRelatedVideosForPerformer({
  performerId,
  ownVideos,
  excludeVideoIds,
  limit,
  now = new Date(),
}: GetDynamicRelatedVideosParams): Promise<PerformerPageVideoRecord[]> {
  if (limit <= 0) return []

  const nowMs = now.getTime()
  const baseWhere = getPublicVideoPoolWhere(now)

  // Extract affinity signals from all of this performer's public videos
  const coPerformerIds = new Set<string>()
  const categoryIds = new Set<string>()
  const tagIds = new Set<string>()

  for (const video of ownVideos) {
    for (const vp of video.performers) {
      if (vp.performer.id !== performerId) {
        coPerformerIds.add(vp.performer.id)
      }
    }
    for (const vc of video.categories) {
      categoryIds.add(vc.category.id)
    }
    for (const vt of video.tags) {
      tagIds.add(vt.tagId)
    }
  }

  const hasOwnStats = ownVideos.length > 0
  const avgViews = hasOwnStats
    ? ownVideos.reduce((sum, v) => sum + v.viewCount, 0) / ownVideos.length
    : 0
  const avgLikes = hasOwnStats
    ? ownVideos.reduce((sum, v) => sum + v.likeCount, 0) / ownVideos.length
    : 0

  const affinityClauses: Prisma.VideoWhereInput[] = []
  if (coPerformerIds.size > 0) {
    affinityClauses.push({
      performers: { some: { performerId: { in: Array.from(coPerformerIds) } } },
    })
  }
  if (categoryIds.size > 0) {
    affinityClauses.push({
      categories: { some: { categoryId: { in: Array.from(categoryIds) } } },
    })
  }
  if (tagIds.size > 0) {
    affinityClauses.push({
      tags: { some: { tagId: { in: Array.from(tagIds) } } },
    })
  }

  const exclusionFilter: Prisma.VideoWhereInput =
    excludeVideoIds.length > 0 ? { id: { notIn: excludeVideoIds } } : {}

  // Query both direct-affinity matches and a general fresh/popular catalog pool in parallel
  const [affinityCandidates, generalRecentCandidates, generalPopularCandidates] = await Promise.all([
    affinityClauses.length > 0
      ? prisma.video.findMany({
          where: {
            AND: [baseWhere, exclusionFilter, { OR: affinityClauses }],
          },
          select: PERFORMER_PAGE_VIDEO_SELECT,
          orderBy: { releaseDate: "desc" },
          take: 40,
        })
      : Promise.resolve([] as PerformerPageVideoRecord[]),
    prisma.video.findMany({
      where: {
        AND: [baseWhere, exclusionFilter],
      },
      select: PERFORMER_PAGE_VIDEO_SELECT,
      orderBy: { releaseDate: "desc" },
      take: 30,
    }),
    prisma.video.findMany({
      where: {
        AND: [baseWhere, exclusionFilter],
      },
      select: PERFORMER_PAGE_VIDEO_SELECT,
      orderBy: [{ viewCount: "desc" }, { likeCount: "desc" }],
      take: 25,
    }),
  ])

  // Deduplicate candidate pool
  const candidateMap = new Map<string, PerformerPageVideoRecord>()
  for (const list of [affinityCandidates, generalRecentCandidates, generalPopularCandidates]) {
    for (const candidate of list) {
      if (!candidateMap.has(candidate.id)) {
        candidateMap.set(candidate.id, candidate)
      }
    }
  }

  const candidates = Array.from(candidateMap.values())
  if (candidates.length === 0) return []

  const logAvgViews = Math.log10(avgViews + 10)
  const logAvgLikes = Math.log10(avgLikes + 5)

  // Compute multi-signal affinity score + weighted probabilistic key for dynamic rotation
  const scored = candidates.map((candidate) => {
    let score = 10

    // 1) Co-performers (actresses who have appeared together in videos)
    if (coPerformerIds.size > 0) {
      let sharedCoPerformers = 0
      for (const vp of candidate.performers) {
        if (coPerformerIds.has(vp.performer.id)) sharedCoPerformers++
      }
      score += Math.min(80, sharedCoPerformers * 45)
    }

    // 2) Shared categories / scene types
    if (categoryIds.size > 0) {
      let sharedCategories = 0
      for (const vc of candidate.categories) {
        if (categoryIds.has(vc.category.id)) sharedCategories++
      }
      score += Math.min(60, sharedCategories * 35)
    }

    // 3) Shared tags
    if (tagIds.size > 0) {
      let sharedTags = 0
      for (const vt of candidate.tags) {
        if (tagIds.has(vt.tagId)) sharedTags++
      }
      score += Math.min(30, sharedTags * 14)
    }

    // 4) Similar views & likes (or organic popularity when performer has 0 videos yet)
    if (hasOwnStats) {
      const viewDist = Math.abs(Math.log10(candidate.viewCount + 10) - logAvgViews)
      const likeDist = Math.abs(Math.log10(candidate.likeCount + 5) - logAvgLikes)
      score += 20 / (1 + viewDist)
      score += 14 / (1 + likeDist)
    } else {
      score += Math.min(24, Math.log10(candidate.viewCount + 10) * 4 + Math.log10(candidate.likeCount + 5) * 3)
    }

    // 5) Freshness & upcoming boost so new releases surface dynamically
    if (isVideoNew(candidate, nowMs) || isVideoScheduled(candidate, nowMs)) {
      score += 15
    } else {
      const ageDays = Math.max(0, (nowMs - candidate.releaseDate.getTime()) / (1000 * 60 * 60 * 24))
      score += Math.max(0, 10 - ageDays / 30)
    }

    // Weighted random sampling without replacement (Efraimidis-Spirakis):
    // Higher-scoring videos are strongly favored, yet each revisit dynamically rotates results.
    const weight = Math.pow(Math.max(1, score), 1.35)
    const u = Math.max(1e-9, Math.random())
    const sampleKey = Math.pow(u, 1 / weight)

    return { candidate, sampleKey }
  })

  scored.sort((a, b) => b.sampleKey - a.sampleKey)
  return scored.slice(0, limit).map((item) => item.candidate)
}
