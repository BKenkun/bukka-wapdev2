import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import {
  DEFAULT_SESSION_TIMEOUT_MINUTES,
  MIN_SESSION_TIMEOUT_MINUTES,
  MAX_SESSION_TIMEOUT_MINUTES,
  clampSessionTimeoutMinutes,
} from "@/lib/session-timeout"

const SETTINGS_KEY = "session_timeout_settings"

interface SessionTimeoutSettingsValue {
  sessionTimeoutMinutes?: number
  updatedAt?: string
  updatedBy?: string
}

// GET - Publicly readable global session inactivity timeout policy
export async function GET() {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: SETTINGS_KEY },
    })

    const value = (setting?.value ?? null) as SessionTimeoutSettingsValue | null
    const sessionTimeoutMinutes =
      value && value.sessionTimeoutMinutes !== undefined
        ? clampSessionTimeoutMinutes(value.sessionTimeoutMinutes)
        : DEFAULT_SESSION_TIMEOUT_MINUTES

    return NextResponse.json(
      {
        sessionTimeoutMinutes,
        updatedAt: value?.updatedAt ?? setting?.updatedAt?.toISOString() ?? null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching session timeout settings:", error)
    return NextResponse.json(
      {
        sessionTimeoutMinutes: DEFAULT_SESSION_TIMEOUT_MINUTES,
        updatedAt: null,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  }
}

// PUT - Admin-only update for global session inactivity timeout policy
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const adminUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    })

    if (!adminUser?.isAdmin) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const rawMinutes = Number(body?.sessionTimeoutMinutes)

    if (!Number.isFinite(rawMinutes)) {
      return NextResponse.json(
        {
          error: `El tiempo de inactividad debe ser un número entre ${MIN_SESSION_TIMEOUT_MINUTES} y ${MAX_SESSION_TIMEOUT_MINUTES} minutos`,
        },
        { status: 400 }
      )
    }

    const sessionTimeoutMinutes = clampSessionTimeoutMinutes(rawMinutes)
    const updatedAt = new Date().toISOString()

    await prisma.siteSettings.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        value: {
          sessionTimeoutMinutes,
          updatedAt,
          updatedBy: session.user.id,
        },
      },
      update: {
        value: {
          sessionTimeoutMinutes,
          updatedAt,
          updatedBy: session.user.id,
        },
      },
    })

    return NextResponse.json(
      {
        sessionTimeoutMinutes,
        updatedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    )
  } catch (error) {
    console.error("Error updating session timeout settings:", error)
    return NextResponse.json(
      { error: "Error al guardar la configuración de inactividad" },
      { status: 500 }
    )
  }
}
