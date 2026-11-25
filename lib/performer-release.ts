import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/admin-notifications"
import { sendTemplateEmail, PerformerAvailableTemplate } from "@/lib/email"

const RELEASE_CHECK_THROTTLE_MS = 15_000

let lastReleaseCheckAt = 0
let inFlightReleaseCheck: Promise<ReleaseSummary> | null = null

export interface ReleaseSummary {
  checked: boolean
  releasedCount: number
  notifiedEmails: number
}

export async function notifyPerformerSubscribers(performer: {
  id: string
  slug: string
  name: string
  profileImage?: string | null
}): Promise<number> {
  const subscribers = await prisma.performerNotify.findMany({
    where: { performerId: performer.id, notified: false },
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
    try {
      const result = await sendTemplateEmail({
        to: sub.user.email,
        template: "performer/available",
        subjectVariables: { performerName: performer.name },
        react: PerformerAvailableTemplate({
          subscriberName: sub.user.name,
          performerName: performer.name,
          performerSlug: performer.slug,
          profileImage: performer.profileImage,
        }),
        metadata: {
          performerId: performer.id,
          performerSlug: performer.slug,
          userId: sub.user.id,
        },
      })

      if (result.success) {
        sentCount++
        notifiedIds.push(sub.id)
      }
    } catch (error) {
      console.error(`Failed to notify ${sub.user.email} for performer ${performer.slug}:`, error)
    }
  }

  if (notifiedIds.length > 0) {
    await prisma.performerNotify.updateMany({
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

async function runDuePerformersRelease(awaitNotifications: boolean): Promise<ReleaseSummary> {
  const now = new Date()

  const duePerformers = await prisma.performer.findMany({
    where: {
      comingSoon: true,
      comingSoonDate: { lte: now },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      profileImage: true,
    },
  })

  if (duePerformers.length === 0) {
    return { checked: true, releasedCount: 0, notifiedEmails: 0 }
  }

  let releasedCount = 0
  let notifiedEmails = 0

  for (const performer of duePerformers) {
    // Atomic claim prevents duplicate emails across concurrent requests/cron runs
    const claimed = await prisma.performer.updateMany({
      where: {
        id: performer.id,
        comingSoon: true,
        comingSoonDate: { lte: now },
      },
      data: {
        comingSoon: false,
        releasedAt: now,
      },
    })

    if (claimed.count !== 1) {
      continue
    }

    releasedCount++

    await createAdminNotification({
      type: "SYSTEM",
      title: "Performer released",
      message: `${performer.name} is now live on the site.`,
      relatedUrl: `/admin/actrices/${performer.id}`,
    })

    if (awaitNotifications) {
      notifiedEmails += await notifyPerformerSubscribers(performer)
    } else {
      void notifyPerformerSubscribers(performer).catch((err) => {
        console.error(`Background notification error for ${performer.slug}:`, err)
      })
    }
  }

  return { checked: true, releasedCount, notifiedEmails }
}

/**
 * Checks for scheduled performers whose comingSoonDate has passed, atomically unlocks them
 * (setting comingSoon = false and releasedAt = now), and triggers pending "Notify Me" emails.
 * Safe and throttled for use inside SSR page loads and API routes.
 */
export async function releaseDuePerformers(options?: {
  force?: boolean
  awaitNotifications?: boolean
}): Promise<ReleaseSummary> {
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
  inFlightReleaseCheck = runDuePerformersRelease(awaitNotifications)
    .catch((error) => {
      console.error("Error releasing due performers:", error)
      return { checked: false, releasedCount: 0, notifiedEmails: 0 }
    })
    .finally(() => {
      inFlightReleaseCheck = null
    })

  return inFlightReleaseCheck
}
