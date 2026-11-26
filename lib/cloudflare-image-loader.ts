import type { ImageLoaderProps } from "next/image"

const CLOUDFLARE_MEDIA_HOST = "media.bukkakery.com"
const WIDTH_TIERS = [480, 800, 1280, 1920] as const
const NON_TRANSFORMABLE_EXT = /\.(svg|ico|gif|mp4|webm|mov|m4v|pdf)(\?.*)?$/i

function getAllowedMediaHosts(): string[] {
  const hosts = [CLOUDFLARE_MEDIA_HOST]
  const configured = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  if (configured) {
    try {
      const parsed = new URL(configured)
      if (parsed.hostname && !hosts.includes(parsed.hostname)) {
        hosts.push(parsed.hostname)
      }
    } catch {
      // Ignore malformed env var
    }
  }
  return hosts
}

function snapWidth(width: number): number {
  for (const tier of WIDTH_TIERS) {
    if (width <= tier) return tier
  }
  return 1920
}

/**
 * Rewrites Cloudflare R2 media URLs (`media.bukkakery.com/...`) to use
 * Cloudflare Image Transformations (`/cdn-cgi/image/...`) with automatic
 * AVIF/WebP conversion and snapped width tiers (480 / 800 / 1280 / 1920)
 * to maximize CDN cache hit rate and minimize unique monthly transformations.
 * Non-R2 URLs, local `/images/...` paths, SVGs, GIFs, and videos are returned untouched.
 */
export function getOptimizedImageUrl(src: string, width: number = 800, quality: number = 80): string {
  if (!src || typeof src !== "string") return src

  // Leave relative paths, data/blob URLs, and already-transformed URLs untouched
  if (!src.startsWith("http://") && !src.startsWith("https://")) return src
  if (src.includes("/cdn-cgi/image/")) return src

  try {
    const parsed = new URL(src)
    const allowedHosts = getAllowedMediaHosts()
    if (!allowedHosts.includes(parsed.hostname)) return src
    if (NON_TRANSFORMABLE_EXT.test(parsed.pathname)) return src

    const cleanPath = parsed.pathname.replace(/^\/+/, "")
    if (!cleanPath) return src

    const snappedWidth = snapWidth(width)
    // Fixed quality (80) keeps cache keys unified across components
    const safeQuality = quality >= 1 && quality <= 100 ? 80 : 80
    const querySuffix = parsed.search || ""

    return `${parsed.origin}/cdn-cgi/image/width=${snappedWidth},quality=${safeQuality},format=auto,fit=scale-down/${cleanPath}${querySuffix}`
  } catch {
    return src
  }
}

export default function cloudflareImageLoader({ src, width, quality }: ImageLoaderProps): string {
  return getOptimizedImageUrl(src, width, quality)
}
