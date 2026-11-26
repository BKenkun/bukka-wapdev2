import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const notifyMeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = notifyMeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email address" },
        { status: 400 }
      )
    }

    const { email } = parsed.data

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: {
        isActive: true,
        unsubscribedAt: null,
        source: "casting",
      },
      create: {
        email,
        source: "casting",
        isActive: true,
        confirmedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error registering casting alert email:", error)
    return NextResponse.json(
      { error: "Could not register your email. Please try again." },
      { status: 500 }
    )
  }
}
