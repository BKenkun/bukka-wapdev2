import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { defaultVideoAccessSettings } from "@/lib/get-video-access-settings"
import {
  DEFAULT_VIDEO_DOWNLOAD_POLICY,
  sanitizeVideoDownloadPolicy,
} from "@/lib/video-download-policy"

const SETTINGS_KEY = "video_access_settings"

// GET - Obtener configuración de acceso a videos
export async function GET() {
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
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const settings = await prisma.siteSettings.findUnique({
      where: { key: SETTINGS_KEY },
    })

    if (!settings) {
      return NextResponse.json(defaultVideoAccessSettings)
    }

    // Merge with defaults to ensure all fields exist
    const value = settings.value as unknown as Partial<typeof defaultVideoAccessSettings>
    return NextResponse.json({
      lockScreen: {
        ...defaultVideoAccessSettings.lockScreen,
        ...value.lockScreen,
      },
      downloadPolicy: value.downloadPolicy
        ? sanitizeVideoDownloadPolicy(value.downloadPolicy)
        : { ...DEFAULT_VIDEO_DOWNLOAD_POLICY },
    })
  } catch (error) {
    console.error("Error fetching video access settings:", error)
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    )
  }
}

// POST - Guardar configuración de acceso a videos
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { lockScreen, downloadPolicy } = body

    const existing = await prisma.siteSettings.findUnique({
      where: { key: SETTINGS_KEY },
    })
    const existingValue = (existing?.value ?? {}) as Partial<typeof defaultVideoAccessSettings>

    const nextLockScreen = {
      ...defaultVideoAccessSettings.lockScreen,
      ...existingValue.lockScreen,
      ...(lockScreen && typeof lockScreen === "object" ? lockScreen : {}),
    }

    const nextDownloadPolicy =
      downloadPolicy !== undefined
        ? sanitizeVideoDownloadPolicy(downloadPolicy)
        : existingValue.downloadPolicy
          ? sanitizeVideoDownloadPolicy(existingValue.downloadPolicy)
          : { ...DEFAULT_VIDEO_DOWNLOAD_POLICY }

    const settingsPayload = {
      lockScreen: nextLockScreen,
      downloadPolicy: {
        enabled: nextDownloadPolicy.enabled,
        delayValue: nextDownloadPolicy.delayValue,
        delayUnit: nextDownloadPolicy.delayUnit,
      },
    }

    await prisma.siteSettings.upsert({
      where: { key: SETTINGS_KEY },
      create: {
        key: SETTINGS_KEY,
        value: settingsPayload,
      },
      update: {
        value: settingsPayload,
      },
    })

    return NextResponse.json({
      success: true,
      lockScreen: nextLockScreen,
      downloadPolicy: nextDownloadPolicy,
    })
  } catch (error) {
    console.error("Error saving video access settings:", error)
    return NextResponse.json(
      { error: "Error al guardar configuración" },
      { status: 500 }
    )
  }
}
