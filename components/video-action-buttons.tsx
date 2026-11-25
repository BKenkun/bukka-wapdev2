"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Clock, Download, Loader2 } from "lucide-react"
import {
  formatDownloadUnlockDate,
  type VideoDownloadAvailabilityReason,
} from "@/lib/video-download-policy"

interface VideoActionButtonsProps {
  videoId: string
  videoSlug: string
  userId?: string | null
  canDownload: boolean
  downloadAvailable?: boolean
  downloadAvailableAt?: string | null
  downloadBlockReason?: VideoDownloadAvailabilityReason
  favoriteCount: number
  viewCount: string
}

function WaterDropIcon({ filled = false }: { filled?: boolean }) {
  const iconColor = filled ? "var(--brand-color)" : "color-mix(in srgb, var(--brand-color) 70%, transparent)"
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="26"
      viewBox="0 0 22 29"
      fill="none"
      style={{ color: iconColor }}
    >
      <path
        d="M16.75 5.14597C15.206 3.29906 13.4682 1.63596 11.5688 0.187435C11.4006 0.0654404 11.2003 0 10.995 0C10.7897 0 10.5894 0.0654404 10.4213 0.187435C8.52531 1.63657 6.7909 3.29964 5.25 5.14597C1.81375 9.23319 0 13.5418 0 17.607C0 20.6286 1.15893 23.5265 3.22183 25.6631C5.28473 27.7997 8.08262 29 11 29C13.9174 29 16.7153 27.7997 18.7782 25.6631C20.8411 23.5265 22 20.6286 22 17.607C22 13.5418 20.1863 9.23319 16.75 5.14597ZM11 26.9286C8.61386 26.9258 6.32622 25.9428 4.63896 24.1953C2.95171 22.4478 2.00265 20.0784 2 17.607C2 10.1977 8.93375 4.01314 11 2.33009C13.0662 4.01314 20 10.1951 20 17.607C19.9974 20.0784 19.0483 22.4478 17.361 24.1953C15.6738 25.9428 13.3861 26.9258 11 26.9286Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function VideoActionButtons({
  videoId,
  videoSlug,
  userId,
  canDownload,
  downloadAvailable = true,
  downloadAvailableAt = null,
  downloadBlockReason = "AVAILABLE",
  favoriteCount: initialFavCount,
  viewCount,
}: VideoActionButtonsProps) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(initialFavCount)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    if (!videoId || !userId) return

    async function checkFavorite() {
      try {
        const res = await fetch(`/api/favorites/check?videoId=${videoId}`)
        if (res.ok) {
          const data = await res.json()
          setIsFavorite(data.isFavorite)
        }
      } catch (error) {
        console.error("Error checking favorite:", error)
      }
    }

    checkFavorite()
  }, [videoId, userId])

  async function handleToggleFavorite() {
    if (!videoId) return

    if (!userId) {
      toast.error("Log in to save to favorites")
      router.push("/?login=true")
      return
    }

    setIsTogglingFavorite(true)
    try {
      if (isFavorite) {
        const res = await fetch(`/api/favorites?videoId=${videoId}`, { method: "DELETE" })
        if (res.ok) {
          setIsFavorite(false)
          setFavoriteCount((prev) => Math.max(0, prev - 1))
          toast.success("Removed from favorites")
        } else {
          throw new Error("Error removing from favorites")
        }
      } else {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        })
        if (res.ok) {
          setIsFavorite(true)
          setFavoriteCount((prev) => prev + 1)
          toast.success("Added to favorites")
        } else {
          const data = await res.json()
          throw new Error(data.error || "Error adding to favorites")
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error updating favorites")
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const unlockDateLabel = downloadAvailableAt
    ? formatDownloadUnlockDate(downloadAvailableAt, "en")
    : null

  const isScheduledForLater =
    !downloadAvailable &&
    (downloadBlockReason === "LOCKED_BY_DELAY" ||
      downloadBlockReason === "LOCKED_BY_CUSTOM_DATE")
  const isDisabledForVideo = !downloadAvailable && downloadBlockReason === "DISABLED"

  async function handleDownload() {
    if (!canDownload) {
      toast.error("Your plan does not allow downloads. Upgrade your subscription.")
      return
    }

    if (isDisabledForVideo) {
      toast.info("Downloads are disabled for this video.")
      return
    }

    if (isScheduledForLater) {
      toast.info(
        unlockDateLabel
          ? `Downloads for this video will unlock on ${unlockDateLabel}.`
          : "Downloads are not available for this video yet."
      )
      return
    }

    setIsDownloading(true)
    try {
      const res = await fetch(`/api/videos/${videoSlug}/download`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Error downloading")
      }

      const link = document.createElement("a")
      link.href = data.downloadUrl
      link.rel = "noopener noreferrer"
      link.download = data.filename || `${videoSlug}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Download started")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error downloading")
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadTooltip = !canDownload
    ? "Upgrade your plan to download"
    : isDisabledForVideo
      ? "Downloads are disabled for this video"
      : isScheduledForLater
        ? unlockDateLabel
          ? `Download available on ${unlockDateLabel}`
          : "Download not available yet"
        : "Download video"

  return (
    <div
      className="flex items-center gap-4"
      style={{ color: "var(--text-muted)" }}
    >
      {/* Views */}
      <div className="flex items-center gap-1.5">
        <svg
          className="w-5 h-5"
          style={{ color: "color-mix(in srgb, var(--brand-color) 70%, transparent)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-sm font-medium">{viewCount}</span>
      </div>

      {/* Favorites / Like */}
      <button
        onClick={handleToggleFavorite}
        disabled={isTogglingFavorite}
        className="flex items-center gap-1.5 p-1 h-auto transition-all duration-200 hover:opacity-80 disabled:opacity-50"
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <WaterDropIcon filled={isFavorite} />
        <span
          className="text-sm font-bold"
          style={{
            color: isFavorite ? "color-mix(in srgb, var(--brand-color) 70%, transparent)" : "inherit",
          }}
        >
          {favoriteCount.toLocaleString("en-US")}
        </span>
      </button>

      {/* Download */}
      {canDownload && isScheduledForLater ? (
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border transition-opacity hover:opacity-85 cursor-pointer"
          style={{
            borderColor: "color-mix(in srgb, var(--border-color) 90%, transparent)",
            color: "var(--text-muted)",
          }}
          title={downloadTooltip}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{unlockDateLabel ? `Download ${unlockDateLabel}` : "Download locked"}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading || !canDownload || isDisabledForVideo}
          className="flex items-center gap-1.5 p-1 h-auto transition-all duration-200 hover:opacity-80 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          title={downloadTooltip}
        >
          {isDownloading ? (
            <Loader2 className="animate-spin w-5 h-5" />
          ) : (
            <Download className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  )
}
