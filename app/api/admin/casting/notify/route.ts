import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { getCastingSettings } from "@/lib/casting-settings"
import { sendCastingCampaignEmails } from "@/lib/casting-campaigns"

const notifyBodySchema = z.object({
  event: z.enum(["opened", "closed"]),
  customMessage: z.string().trim().max(1000).optional(),
  testEmail: z.string().trim().email().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })

    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = notifyBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const settings = await getCastingSettings()
    const result = await sendCastingCampaignEmails(parsed.data.event, settings, {
      customMessage: parsed.data.customMessage,
      testEmail: parsed.data.testEmail,
    })

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error("Error dispatching casting campaign email:", error)
    return NextResponse.json(
      { error: "Error sending casting campaign notifications" },
      { status: 500 }
    )
  }
}
