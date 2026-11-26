import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  castingSettingsUpdateSchema,
  getCastingSettings,
  saveCastingSettings,
  type CastingSettings,
} from "@/lib/casting-settings"
import {
  getCastingAudienceStats,
  sendCastingCampaignEmails,
  type CastingCampaignDispatchResult,
} from "@/lib/casting-campaigns"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  })
  if (!user?.isAdmin) {
    return null
  }
  return user
}

export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [settings, audienceStats, recentLogs] = await Promise.all([
      getCastingSettings(),
      getCastingAudienceStats(),
      prisma.emailLog.findMany({
        where: {
          template: {
            in: ["casting/campaign-opened", "casting/campaign-closed"],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          to: true,
          subject: true,
          template: true,
          status: true,
          error: true,
          createdAt: true,
        },
      }),
    ])

    return NextResponse.json({
      settings,
      audienceStats,
      recentLogs,
      adminEmail: admin.email,
    })
  } catch (error) {
    console.error("Error loading casting settings:", error)
    return NextResponse.json(
      { error: "Error loading casting settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = castingSettingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid casting settings",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    const previous = await getCastingSettings()
    const nextSettings: CastingSettings = {
      ...previous,
      ...parsed.data,
    }

    await saveCastingSettings(nextSettings)

    // Trigger transactional campaign email automatically if campaign status changed and autoNotify is enabled
    let dispatchResult: CastingCampaignDispatchResult | null = null
    if (
      previous.campaignStatus !== "open" &&
      nextSettings.campaignStatus === "open" &&
      nextSettings.autoNotifyOnOpen
    ) {
      dispatchResult = await sendCastingCampaignEmails("opened", nextSettings)
    } else if (
      previous.campaignStatus !== "closed" &&
      nextSettings.campaignStatus === "closed" &&
      nextSettings.autoNotifyOnClose
    ) {
      dispatchResult = await sendCastingCampaignEmails("closed", nextSettings)
    }

    const refreshed = await getCastingSettings()

    return NextResponse.json({
      success: true,
      settings: refreshed,
      dispatchResult,
    })
  } catch (error) {
    console.error("Error saving casting settings:", error)
    return NextResponse.json(
      { error: "Error saving casting settings" },
      { status: 500 }
    )
  }
}
