import { prisma } from "@/lib/prisma"
import { createAdminNotification } from "@/lib/admin-notifications"
import {
  sendTemplateEmail,
  getEmailSettings,
  CastingCampaignOpenedTemplate,
  CastingCampaignClosedTemplate,
} from "@/lib/email"
import {
  buildCampaignKey,
  formatCastingDate,
  formatCastingDateRange,
  getCastingSettings,
  saveCastingSettings,
  type CastingNotifyAudience,
  type CastingSettings,
} from "@/lib/casting-settings"

export type CastingCampaignEvent = "opened" | "closed"

export interface CastingAudienceStats {
  applicants_only: number
  all_subscribers_and_applicants: number
  users_and_subscribers: number
}

export interface CastingCampaignDispatchResult {
  event: CastingCampaignEvent
  totalRecipients: number
  sent: number
  failed: number
  skipped: number
  isTest: boolean
}

function normalizeEmails(emails: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  for (const raw of emails) {
    const clean = raw?.trim().toLowerCase()
    if (clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      seen.add(clean)
    }
  }
  return Array.from(seen)
}

export async function getCastingAudienceRecipients(
  audience: CastingNotifyAudience
): Promise<string[]> {
  const [castingSubmissions, castingSubscribers] = await Promise.all([
    prisma.castingSubmission.findMany({
      select: { email: true },
    }),
    prisma.newsletterSubscriber.findMany({
      where: { isActive: true, source: "casting" },
      select: { email: true },
    }),
  ])

  const baseEmails = [
    ...castingSubmissions.map((s) => s.email),
    ...castingSubscribers.map((s) => s.email),
  ]

  if (audience === "applicants_only") {
    return normalizeEmails(baseEmails)
  }

  const allSubscribers = await prisma.newsletterSubscriber.findMany({
    where: { isActive: true },
    select: { email: true },
  })

  const subAndApplicantEmails = [
    ...baseEmails,
    ...allSubscribers.map((s) => s.email),
  ]

  if (audience === "all_subscribers_and_applicants") {
    return normalizeEmails(subAndApplicantEmails)
  }

  const users = await prisma.user.findMany({
    select: { email: true },
  })

  return normalizeEmails([...subAndApplicantEmails, ...users.map((u) => u.email)])
}

export async function getCastingAudienceStats(): Promise<CastingAudienceStats> {
  const [castingSubmissions, allSubscribers, users] = await Promise.all([
    prisma.castingSubmission.findMany({ select: { email: true } }),
    prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true, source: true },
    }),
    prisma.user.findMany({ select: { email: true } }),
  ])

  const castingSubs = allSubscribers.filter((s) => s.source === "casting")
  const applicantsOnly = normalizeEmails([
    ...castingSubmissions.map((s) => s.email),
    ...castingSubs.map((s) => s.email),
  ])
  const allSubsAndApplicants = normalizeEmails([
    ...applicantsOnly,
    ...allSubscribers.map((s) => s.email),
  ])
  const usersAndSubs = normalizeEmails([
    ...allSubsAndApplicants,
    ...users.map((u) => u.email),
  ])

  return {
    applicants_only: applicantsOnly.length,
    all_subscribers_and_applicants: allSubsAndApplicants.length,
    users_and_subscribers: usersAndSubs.length,
  }
}

export async function sendCastingCampaignEmails(
  event: CastingCampaignEvent,
  settings: CastingSettings,
  options?: {
    customMessage?: string
    testEmail?: string
  }
): Promise<CastingCampaignDispatchResult> {
  const isTest = Boolean(options?.testEmail)
  const recipients = options?.testEmail
    ? normalizeEmails([options.testEmail])
    : await getCastingAudienceRecipients(settings.notifyAudience)

  if (recipients.length === 0) {
    return {
      event,
      totalRecipients: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      isTest,
    }
  }

  const emailSettings = await getEmailSettings()
  const campaignName = settings.campaignName.trim() || "Open Casting"
  const applicationsCloseText = formatCastingDate(settings.applicationsCloseDate)
  const auditionsText = formatCastingDateRange(
    settings.auditionsStartDate,
    settings.auditionsEndDate
  )
  const resultsText = formatCastingDate(settings.resultsDate)

  const templateKey =
    event === "opened" ? "casting/campaign-opened" : "casting/campaign-closed"

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const email of recipients) {
    try {
      const react =
        event === "opened"
          ? CastingCampaignOpenedTemplate({
              campaignName,
              applicationsCloseText: applicationsCloseText || undefined,
              auditionsText: auditionsText || undefined,
              resultsText: resultsText || undefined,
              customMessage: options?.customMessage,
              logoUrl: emailSettings.logoUrl,
              primaryColor: emailSettings.primaryColor,
            })
          : CastingCampaignClosedTemplate({
              campaignName,
              auditionsText: auditionsText || undefined,
              resultsText: resultsText || undefined,
              customMessage: options?.customMessage || settings.closedMessage || undefined,
              logoUrl: emailSettings.logoUrl,
              primaryColor: emailSettings.primaryColor,
            })

      const res = await sendTemplateEmail({
        to: email,
        template: templateKey,
        subjectVariables: {
          campaignName,
          closeDate: applicationsCloseText || "",
          resultsDate: resultsText || "",
        },
        react,
        metadata: {
          castingCampaignEvent: event,
          campaignName,
          isTest,
        },
      })

      if (res.success) {
        if (res.data?.id === "skipped") {
          skipped++
        } else {
          sent++
        }
      } else {
        failed++
      }
    } catch (error) {
      console.error(`[Casting Campaign] Failed sending ${event} email to ${email}:`, error)
      failed++
    }
  }

  if (!isTest) {
    const campaignKey = buildCampaignKey(settings)
    const nowIso = new Date().toISOString()
    const updatedSettings: CastingSettings = {
      ...settings,
      ...(event === "opened"
        ? { lastOpenedNotifiedKey: campaignKey, lastOpenedSentAt: nowIso }
        : { lastClosedNotifiedKey: campaignKey, lastClosedSentAt: nowIso }),
    }
    await saveCastingSettings(updatedSettings).catch((err) => {
      console.error("[Casting Campaign] Failed persisting notification timestamp:", err)
    })

    await createAdminNotification({
      type: "SYSTEM",
      title:
        event === "opened"
          ? "Campaña de casting abierta — Emails enviados"
          : "Campaña de casting cerrada — Emails enviados",
      message: `${campaignName}: ${sent} enviados, ${failed} fallidos, ${skipped} omitidos (de ${recipients.length} destinatarios).`,
      relatedUrl: "/admin/casting",
    }).catch(() => undefined)
  }

  return {
    event,
    totalRecipients: recipients.length,
    sent,
    failed,
    skipped,
    isTest,
  }
}

/**
 * Invoked by daily cron to automatically dispatch casting opened/closed campaign emails
 * when scheduled dates arrive/expire. Idempotent per campaign key.
 */
export async function processScheduledCastingCampaigns(
  now: Date = new Date()
): Promise<{
  openedSent: number
  closedSent: number
  autoClosedStatus: boolean
}> {
  const settings = await getCastingSettings()
  const campaignKey = buildCampaignKey(settings)

  let openedSent = 0
  let closedSent = 0
  let autoClosedStatus = false

  // 1) Auto-close & notify when applicationsCloseDate has passed
  if (settings.applicationsCloseDate) {
    const closeEnd = new Date(`${settings.applicationsCloseDate}T23:59:59.999Z`)
    if (!Number.isNaN(closeEnd.getTime()) && now > closeEnd) {
      let workingSettings = settings
      if (settings.campaignStatus === "open") {
        workingSettings = { ...settings, campaignStatus: "closed" }
        await saveCastingSettings(workingSettings)
        autoClosedStatus = true
      }

      if (
        workingSettings.autoNotifyOnClose &&
        workingSettings.lastClosedNotifiedKey !== campaignKey
      ) {
        const res = await sendCastingCampaignEmails("closed", workingSettings)
        closedSent = res.sent
      }

      return { openedSent, closedSent, autoClosedStatus }
    }
  }

  // 2) Auto-notify when applicationsOpenDate has arrived and campaign is open
  if (
    settings.campaignStatus === "open" &&
    settings.autoNotifyOnOpen &&
    settings.applicationsOpenDate &&
    settings.lastOpenedNotifiedKey !== campaignKey
  ) {
    const openStart = new Date(`${settings.applicationsOpenDate}T00:00:00.000Z`)
    if (!Number.isNaN(openStart.getTime()) && now >= openStart) {
      const res = await sendCastingCampaignEmails("opened", settings)
      openedSent = res.sent
    }
  }

  return { openedSent, closedSent, autoClosedStatus }
}
