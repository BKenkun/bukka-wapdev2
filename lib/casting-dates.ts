export type CastingCampaignStatus = "open" | "closed"

export type CastingNotifyAudience =
  | "all_subscribers_and_applicants"
  | "applicants_only"
  | "users_and_subscribers"

export interface CastingSettings {
  campaignName: string
  campaignStatus: CastingCampaignStatus
  closedMessage: string
  showImportantDates: boolean
  applicationsOpenDate: string
  applicationsCloseDate: string
  auditionsStartDate: string
  auditionsEndDate: string
  resultsDate: string
  autoNotifyOnOpen: boolean
  autoNotifyOnClose: boolean
  notifyAudience: CastingNotifyAudience
  lastOpenedNotifiedKey: string | null
  lastClosedNotifiedKey: string | null
  lastOpenedSentAt: string | null
  lastClosedSentAt: string | null
}

export interface PublicCastingSettings {
  campaignName: string
  campaignStatus: CastingCampaignStatus
  closedMessage: string
  showImportantDates: boolean
  applicationsOpenDate: string
  applicationsCloseDate: string
  auditionsStartDate: string
  auditionsEndDate: string
  resultsDate: string
  isEffectivelyOpen: boolean
  closedReason: "manual" | "deadline_passed" | "not_yet_open" | null
}

export const DEFAULT_CASTING_SETTINGS: CastingSettings = {
  campaignName: "Open Casting",
  campaignStatus: "open",
  closedMessage:
    "Applications for this casting round are currently closed. Leave your email below and we will notify you as soon as the next casting opens.",
  showImportantDates: true,
  applicationsOpenDate: "",
  applicationsCloseDate: "",
  auditionsStartDate: "",
  auditionsEndDate: "",
  resultsDate: "",
  autoNotifyOnOpen: true,
  autoNotifyOnClose: true,
  notifyAudience: "all_subscribers_and_applicants",
  lastOpenedNotifiedKey: null,
  lastClosedNotifiedKey: null,
  lastOpenedSentAt: null,
  lastClosedSentAt: null,
}

export function formatCastingDate(dateStr?: string | null, locale = "en-US"): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ""
  const [year, month, day] = dateStr.split("-").map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d)
}

export function formatCastingDateRange(
  startStr?: string | null,
  endStr?: string | null,
  locale = "en-US"
): string {
  const hasStart = Boolean(startStr && /^\d{4}-\d{2}-\d{2}$/.test(startStr))
  const hasEnd = Boolean(endStr && /^\d{4}-\d{2}-\d{2}$/.test(endStr))

  if (!hasStart && !hasEnd) return ""
  if (hasStart && !hasEnd) return formatCastingDate(startStr, locale)
  if (!hasStart && hasEnd) return formatCastingDate(endStr, locale)

  const [sy, sm, sd] = startStr!.split("-").map(Number)
  const [ey, em, ed] = endStr!.split("-").map(Number)

  if (sy === ey && sm === em && sd === ed) {
    return formatCastingDate(startStr, locale)
  }

  const startDate = new Date(Date.UTC(sy, sm - 1, sd))
  const endDate = new Date(Date.UTC(ey, em - 1, ed))

  if (sy === ey && sm === em) {
    const monthName = new Intl.DateTimeFormat(locale, {
      month: "long",
      timeZone: "UTC",
    }).format(startDate)
    return `${monthName} ${sd}-${ed}, ${sy}`
  }

  if (sy === ey) {
    const startPart = new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(startDate)
    const endPart = new Intl.DateTimeFormat(locale, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(endDate)
    return `${startPart} - ${endPart}`
  }

  return `${formatCastingDate(startStr, locale)} - ${formatCastingDate(endStr, locale)}`
}
