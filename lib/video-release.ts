import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/admin-notifications"
import { sendTemplateEmail, VideoAvailableTemplate } from "@/lib/email"

const RELEASE_CHECK_THROTTLE_MS = 15_000

let lastReleaseCheckAt = 0
let inFlightReleaseCheck: Promise<VideoReleaseSummary> | null = null

export interface VideoReleaseSummary {
  checked: boolean
  releasedCount: number
  notifiedEmails: number
}

export async function notifyVideoSubscribers(video: {
  id: string
  slug: string
  title: string
  thumbnailUrl?: string | null
  performerNames?: string | null
  categoryName?: string | null
}): Promise<number> {
  const subscribers = await prisma.videoNotify.findMany({
    where: { videoId: video.id, notified: false },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  })

  if (subscribers.length === 0) {
    return 0
  }

  let sentCount = 0
  const notifiedIds: string[] = []

  for (const sub of subscribers) {
    if (!sub.user?.email) continue
    try {
      const result = await sendTemplateEmail({
        to: sub.user.email,
        template: "video/available",
        subjectVariables: {
          videoTitle: video.performerNames
            ? `${video.performerNames} — ${video.title}`
            : video.title,
        },
        react: VideoAvailableTemplate({
          subscriberName: sub.user.name,
          videoTitle: video.title,
          videoSlug: video.slug,
          performerNames: video.performerNames,
          categoryName: video.categoryName,
          thumbnailUrl: video.thumbnailUrl,
        }),
        metadata: {
          videoId: video.id,
          videoSlug: video.slug,
          userId: sub.user.id,
        },
      })

      if (result.success) {
        sentCount++
        notifiedIds.push(sub.id)
      }
    } catch (error) {
      console.error(`Failed to notify ${sub.user.email} for video ${video.slug}:`, error)
    }
  }

  if (notifiedIds.length > 0) {
    await prisma.videoNotify.updateMany({
      where: {
        id: { in: notifiedIds },
        notified: false,
      },
      data: {
        notified: true,
        notifiedAt: new Date(),
      },
    })
  }

  return sentCount
}

async function runDueVideosRelease(awaitNotifications: boolean): Promise<VideoReleaseSummary> {
  const now = new Date()

  // 1) Promote SCHEDULED videos whose releaseDate has arrived
  const dueScheduledVideos = await prisma.video.findMany({
    where: {
      status: "SCHEDULED",
      releaseDate: { lte: now },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      performers: {
        include: { performer: { select: { name: true } } },
      },
      categories: {
        include: { category: { select: { name: true } } },
        take: 1,
      },
    },
  })

  let releasedCount = 0
  let notifiedEmails = 0
  const handledVideoIds = new Set<string>()

  for (const video of dueScheduledVideos) {
    // Atomic claim prevents duplicate releases & notifications across concurrent requests/cron runs
    const claimed = await prisma.video.updateMany({
      where: {
        id: video.id,
        status: "SCHEDULED",
        releaseDate: { lte: now },
      },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
      },
    })

    if (claimed.count !== 1) {
      continue
    }

    releasedCount++
    handledVideoIds.add(video.id)

    const performerNames = video.performers.map((p) => p.performer.name).join(" & ") || null
    const categoryName = video.categories[0]?.category.name || null

    await createAdminNotification({
      type: "SYSTEM",
      title: "Vídeo estrenado",
      message: `${video.title} ya está publicado en la web.`,
      relatedUrl: `/admin/videos/${video.id}`,
    })

    const payload = {
      id: video.id,
      slug: video.slug,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      performerNames,
      categoryName,
    }

    if (awaitNotifications) {
      notifiedEmails += await notifyVideoSubscribers(payload)
    } else {
      void notifyVideoSubscribers(payload).catch((err) => {
        console.error(`Background video notification error for ${video.slug}:`, err)
      })
    }
  }

  // 2) Also notify any pending subscribers for already-PUBLISHED videos whose releaseDate has now passed
  const duePublishedWithPending = await prisma.video.findMany({
    where: {
      status: "PUBLISHED",
      releaseDate: { lte: now },
      notifications: {
        some: { notified: false },
      },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      performers: {
        include: { performer: { select: { name: true } } },
      },
      categories: {
        include: { category: { select: { name: true } } },
        take: 1,
      },
    },
  })

  for (const video of duePublishedWithPending) {
    if (handledVideoIds.has(video.id)) continue
    const performerNames = video.performers.map((p) => p.performer.name).join(" & ") || null
    const categoryName = video.categories[0]?.category.name || null
    const payload = {
      id: video.id,
      slug: video.slug,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      performerNames,
      categoryName,
    }

    if (awaitNotifications) {
      notifiedEmails += await notifyVideoSubscribers(payload)
    } else {
      void notifyVideoSubscribers(payload).catch((err) => {
        console.error(`Background video notification error for ${video.slug}:`, err)
      })
    }
  }

  return { checked: true, releasedCount, notifiedEmails }
}

/**
 * Checks for scheduled videos whose releaseDate has passed, atomically publishes them,
 * and dispatches pending "Notify Me" subscriber emails.
 * Throttled for safe invocation inside SSR renders and API routes.
 */
export async function releaseDueVideos(options?: {
  force?: boolean
  awaitNotifications?: boolean
}): Promise<VideoReleaseSummary> {
  const force = options?.force ?? false
  const awaitNotifications = options?.awaitNotifications ?? false
  const nowMs = Date.now()

  if (!force && nowMs - lastReleaseCheckAt < RELEASE_CHECK_THROTTLE_MS) {
    return { checked: false, releasedCount: 0, notifiedEmails: 0 }
  }

  if (inFlightReleaseCheck) {
    return inFlightReleaseCheck
  }

  lastReleaseCheckAt = nowMs
  inFlightReleaseCheck = runDueVideosRelease(awaitNotifications)
    .catch((error) => {
      console.error("Error releasing due videos:", error)
      return { checked: false, releasedCount: 0, notifiedEmails: 0 }
    })
    .finally(() => {
      inFlightReleaseCheck = null
    })

  return inFlightReleaseCheck
}
