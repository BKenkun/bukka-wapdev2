export type BannerContentPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

/**
 * Validates banner link URLs to block unsafe schemes (javascript:, data:, etc.).
 * Allows relative paths ("/...", "#...") and http(s) URLs.
 */
export function sanitizeBannerUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed
  }
  if (trimmed.startsWith("#")) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed
    }
  } catch {
    return undefined
  }

  return undefined
}

/**
 * Converts a #RGB or #RRGGBB hex string + opacity (0..1) into an rgba() CSS string.
 * Falls back to black if hex is invalid.
 */
export function hexToRgba(hex?: string | null, opacity = 0.6): string {
  const clampedOpacity = Math.min(1, Math.max(0, Number.isFinite(opacity) ? opacity : 0.6))
  const clean = (hex || "#000000").trim().replace(/^#/, "")

  let r = 0
  let g = 0
  let b = 0

  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }

  return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`
}

/**
 * Formats an editorial banner kicker like "NEW SCENE | CATEGORY".
 * Splits on "|" so the component can style the accent label, separator, and category cleanly.
 */
export function parseBannerKicker(kicker?: string | null): {
  primary: string
  secondary?: string
} | null {
  if (!kicker?.trim()) return null
  const parts = kicker
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return null
  if (parts.length === 1) return { primary: parts[0] }
  return {
    primary: parts[0],
    secondary: parts.slice(1).join(" · "),
  }
}

/**
 * Parses a date string from either `datetime-local` ("YYYY-MM-DDTHH:mm"),
 * ISO string, or legacy date-only ("YYYY-MM-DD") into an ISO timestamp string.
 */
export function parseTargetDateToIso(raw?: string | null): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  // Legacy YYYY-MM-DD format -> treat as local midnight (matches previous behavior)
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00` : trimmed
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function toDateTimeLocalInput(raw?: string | Date | null): string {
  if (!raw) return ""
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw.trim())) {
    return raw.trim()
  }
  const normalized =
    typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
      ? `${raw.trim()}T00:00`
      : raw
  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
