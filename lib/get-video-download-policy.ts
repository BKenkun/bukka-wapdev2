import { prisma } from "@/lib/prisma"
import {
  DEFAULT_VIDEO_DOWNLOAD_OVERRIDE,
  DEFAULT_VIDEO_DOWNLOAD_POLICY,
  type VideoDownloadOverride,
  type VideoDownloadPolicy,
  sanitizeVideoDownloadOverride,
  sanitizeVideoDownloadPolicy,
} from "@/lib/video-download-policy"

const VIDEO_ACCESS_SETTINGS_KEY = "video_access_settings"
const VIDEO_DOWNLOAD_OVERRIDES_KEY = "video_download_overrides"

type OverrideMap = Record<string, VideoDownloadOverride>

export async function getVideoDownloadPolicy(): Promise<VideoDownloadPolicy> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { key: VIDEO_ACCESS_SETTINGS_KEY },
    })

    if (!settings?.value || typeof settings.value !== "object") {
      return { ...DEFAULT_VIDEO_DOWNLOAD_POLICY }
    }

    const value = settings.value as Record<string, unknown>
    if (!value.downloadPolicy) {
      return { ...DEFAULT_VIDEO_DOWNLOAD_POLICY }
    }

    return sanitizeVideoDownloadPolicy(value.downloadPolicy)
  } catch (error) {
    console.error("Error fetching video download policy:", error)
    return { ...DEFAULT_VIDEO_DOWNLOAD_POLICY }
  }
}

async function readOverrideMap(): Promise<OverrideMap> {
  try {
    const setting = await prisma.siteSettings.findUnique({
      where: { key: VIDEO_DOWNLOAD_OVERRIDES_KEY },
    })
    if (!setting?.value || typeof setting.value !== "object" || Array.isArray(setting.value)) {
      return {}
    }
    return setting.value as unknown as OverrideMap
  } catch (error) {
    console.error("Error reading video download overrides:", error)
    return {}
  }
}

export async function getVideoDownloadOverride(
  videoId: string
): Promise<VideoDownloadOverride> {
  if (!videoId) return { ...DEFAULT_VIDEO_DOWNLOAD_OVERRIDE }
  const map = await readOverrideMap()
  const entry = map[videoId]
  return entry
    ? sanitizeVideoDownloadOverride(entry)
    : { ...DEFAULT_VIDEO_DOWNLOAD_OVERRIDE }
}

export async function setVideoDownloadOverride(
  videoId: string,
  override: unknown
): Promise<VideoDownloadOverride> {
  const sanitized = sanitizeVideoDownloadOverride(override)
  const map = await readOverrideMap()

  if (sanitized.mode === "default") {
    if (!(videoId in map)) {
      return sanitized
    }
    delete map[videoId]
  } else {
    map[videoId] = sanitized
  }

  await prisma.siteSettings.upsert({
    where: { key: VIDEO_DOWNLOAD_OVERRIDES_KEY },
    create: {
      key: VIDEO_DOWNLOAD_OVERRIDES_KEY,
      value: map as unknown as object,
    },
    update: {
      value: map as unknown as object,
    },
  })

  return sanitized
}
