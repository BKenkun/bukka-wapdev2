import type { Prisma } from "@prisma/client"

export const UPCOMING_VIDEO_POOL_WINDOW_DAYS = 10
export const UPCOMING_VIDEO_POOL_WINDOW_MS =
  UPCOMING_VIDEO_POOL_WINDOW_DAYS * 24 * 60 * 60 * 1000

export const NEW_VIDEO_WINDOW_DAYS = 7
export const NEW_VIDEO_WINDOW_MS = NEW_VIDEO_WINDOW_DAYS * 24 * 60 * 60 * 1000

export interface VideoScheduleFields {
  status?: string | null
  releaseDate?: string | Date | null
  publishedAt?: string | Date | null
}

function toMs(value?: string | Date | null): number | null {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Returns true when a video is currently scheduled (locked) for a future release.
 */
export function isVideoScheduled(
  video: VideoScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (video.status !== "SCHEDULED") return false
  const targetMs = toMs(video.releaseDate)
  if (targetMs === null) return true
  return targetMs > nowMs
}

/**
 * Returns true when a scheduled video falls within the 10-day upcoming preview window.
 */
export function isVideoInUpcomingPool(
  video: VideoScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (video.status !== "SCHEDULED") return false
  const targetMs = toMs(video.releaseDate)
  if (targetMs === null) return false
  return targetMs > nowMs && targetMs <= nowMs + UPCOMING_VIDEO_POOL_WINDOW_MS
}

/**
 * Returns true when a video is published and within 7 days of release.
 */
export function isVideoNew(
  video: VideoScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (video.status && video.status !== "PUBLISHED") return false
  if (isVideoScheduled(video, nowMs)) return false

  const referenceMs = toMs(video.publishedAt) ?? toMs(video.releaseDate)
  if (referenceMs === null) return false

  const elapsed = nowMs - referenceMs
  return elapsed >= 0 && elapsed <= NEW_VIDEO_WINDOW_MS
}

/**
 * Prisma where-clause fragment matching all PUBLISHED videos plus SCHEDULED videos
 * whose releaseDate is within the next 10 days.
 * Combine inside `AND: [getPublicVideoPoolWhere(now), ...]` when other `OR` clauses exist.
 */
export function getPublicVideoPoolWhere(now: Date = new Date()): Prisma.VideoWhereInput {
  const windowEnd = new Date(now.getTime() + UPCOMING_VIDEO_POOL_WINDOW_MS)
  return {
    OR: [
      { status: "PUBLISHED" },
      {
        status: "SCHEDULED",
        releaseDate: {
          gt: now,
          lte: windowEnd,
        },
      },
    ],
  }
}

/**
 * Prisma where-clause fragment matching only SCHEDULED videos inside the 10-day window.
 */
export function getUpcomingWindowVideosWhere(now: Date = new Date()): Prisma.VideoWhereInput {
  const windowEnd = new Date(now.getTime() + UPCOMING_VIDEO_POOL_WINDOW_MS)
  return {
    status: "SCHEDULED",
    releaseDate: {
      gt: now,
      lte: windowEnd,
    },
  }
}
