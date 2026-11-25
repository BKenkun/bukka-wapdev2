import { parseBannerKicker } from "@/lib/banner-utils"
import { cn } from "@/lib/utils"

interface BannerKickerProps {
  text?: string | null
  align?: "left" | "center" | "right"
  className?: string
  accentColor?: string
}

/**
 * Unified editorial banner kicker rendered across Upcoming Scene, Home CTA banners,
 * and Shop banners. Formats strings like "NEW SCENE | CATEGORY" with tracked uppercase
 * typography and a crisp vertical divider — never boxed in a pill.
 */
export function BannerKicker({
  text,
  align = "center",
  className,
  accentColor,
}: BannerKickerProps) {
  const parsed = parseBannerKicker(text)
  if (!parsed) return null

  const justifyClass =
    align === "left"
      ? "justify-start"
      : align === "right"
        ? "justify-end"
        : "justify-center"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.26em] drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]",
        justifyClass,
        className
      )}
      style={{ fontFamily: "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))" }}
    >
      <span style={{ color: accentColor || "var(--brand-color, #FA4860)" }}>
        {parsed.primary}
      </span>
      {parsed.secondary && (
        <>
          <span aria-hidden="true" className="text-white/40 font-light select-none">
            |
          </span>
          <span className="text-white/95">{parsed.secondary}</span>
        </>
      )}
    </div>
  )
}
