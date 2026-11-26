import { z } from "zod"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_CASTING_SETTINGS,
  formatCastingDate,
  formatCastingDateRange,
  type CastingCampaignStatus,
  type CastingNotifyAudience,
  type CastingSettings,
  type PublicCastingSettings,
} from "@/lib/casting-dates"

export {
  DEFAULT_CASTING_SETTINGS,
  formatCastingDate,
  formatCastingDateRange,
  type CastingCampaignStatus,
  type CastingNotifyAudience,
  type CastingSettings,
  type PublicCastingSettings,
}

export const CASTING_SETTINGS_KEY = "casting_settings"

const isoDateStringSchema = z
  .string()
  .trim()
  .refine((val) => val === "" || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Invalid date format (YYYY-MM-DD)",
  })

export const castingSettingsUpdateSchema = z.object({
  campaignName: z.string().trim().min(1).max(120).optional(),
  campaignStatus: z.enum(["open", "closed"]).optional(),
  closedMessage: z.string().trim().max(600).optional(),
  showImportantDates: z.boolean().optional(),
  applicationsOpenDate: isoDateStringSchema.optional(),
  applicationsCloseDate: isoDateStringSchema.optional(),
  auditionsStartDate: isoDateStringSchema.optional(),
  auditionsEndDate: isoDateStringSchema.optional(),
  resultsDate: isoDateStringSchema.optional(),
  autoNotifyOnOpen: z.boolean().optional(),
  autoNotifyOnClose: z.boolean().optional(),
  notifyAudience: z
    .enum(["all_subscribers_and_applicants", "applicants_only", "users_and_subscribers"])
    .optional(),
})

export function buildCampaignKey(settings: CastingSettings): string {
  return [
    settings.campaignName.trim() || "casting",
    settings.applicationsOpenDate || "",
    settings.applicationsCloseDate || "",
  ].join("|")
}

export function getEffectiveCastingState(
  settings: CastingSettings,
  now: Date = new Date()
): {
  isEffectivelyOpen: boolean
  closedReason: "manual" | "deadline_passed" | "not_yet_open" | null
} {
  if (settings.campaignStatus === "closed") {
    return { isEffectivelyOpen: false, closedReason: "manual" }
  }

  if (settings.applicationsCloseDate) {
    const closeEnd = new Date(`${settings.applicationsCloseDate}T23:59:59.999Z`)
    if (!Number.isNaN(closeEnd.getTime()) && now > closeEnd) {
      return { isEffectivelyOpen: false, closedReason: "deadline_passed" }
    }
  }

  if (settings.applicationsOpenDate) {
    const openStart = new Date(`${settings.applicationsOpenDate}T00:00:00.000Z`)
    if (!Number.isNaN(openStart.getTime()) && now < openStart) {
      return { isEffectivelyOpen: false, closedReason: "not_yet_open" }
    }
  }

  return { isEffectivelyOpen: true, closedReason: null }
}

export function toPublicCastingSettings(
  settings: CastingSettings,
  now: Date = new Date()
): PublicCastingSettings {
  const effective = getEffectiveCastingState(settings, now)
  return {
    campaignName: settings.campaignName,
    campaignStatus: settings.campaignStatus,
    closedMessage: settings.closedMessage,
    showImportantDates: settings.showImportantDates,
    applicationsOpenDate: settings.applicationsOpenDate,
    applicationsCloseDate: settings.applicationsCloseDate,
    auditionsStartDate: settings.auditionsStartDate,
    auditionsEndDate: settings.auditionsEndDate,
    resultsDate: settings.resultsDate,
    isEffectivelyOpen: effective.isEffectivelyOpen,
    closedReason: effective.closedReason,
  }
}

export async function getCastingSettings(): Promise<CastingSettings> {
  try {
    const row = await prisma.siteSettings.findUnique({
      where: { key: CASTING_SETTINGS_KEY },
    })
    if (row?.value && typeof row.value === "object" && !Array.isArray(row.value)) {
      return {
        ...DEFAULT_CASTING_SETTINGS,
        ...(row.value as Partial<CastingSettings>),
      }
    }
  } catch (error) {
    console.error("Error fetching casting settings:", error)
  }
  return { ...DEFAULT_CASTING_SETTINGS }
}

export async function saveCastingSettings(
  nextSettings: CastingSettings
): Promise<CastingSettings> {
  await prisma.siteSettings.upsert({
    where: { key: CASTING_SETTINGS_KEY },
    update: { value: nextSettings as unknown as object },
    create: {
      key: CASTING_SETTINGS_KEY,
      value: nextSettings as unknown as object,
    },
  })
  return nextSettings
}
