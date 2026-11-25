import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ShopSettingsHero } from "@/lib/get-shop-settings"
import { BannerKicker } from "@/components/banner-kicker"
import { sanitizeBannerUrl } from "@/lib/banner-utils"

interface ShopHeroProps {
  hero: ShopSettingsHero
}

export function ShopHero({ hero }: ShopHeroProps) {
  if (!hero.enabled) return null

  const primaryUrl = sanitizeBannerUrl(hero.ctaPrimaryUrl) || "/shop#productos"
  const secondaryUrl = sanitizeBannerUrl(hero.ctaSecondaryUrl)

  return (
    <section
      className="relative w-full overflow-hidden bg-black"
      style={{
        background: hero.backgroundImageUrl
          ? undefined
          : `linear-gradient(135deg, var(--brand-color, #E03E54) 0%, #000 100%)`,
      }}
    >
      {hero.backgroundImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${hero.backgroundImageUrl})` }}
          />
          <div className="absolute inset-0 bg-black/55" />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/35 pointer-events-none"
          />
        </>
      )}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 py-24 md:py-32">
        <div className="max-w-3xl">
          {hero.badgeText && (
            <BannerKicker
              text={hero.badgeText}
              align="left"
              className="mb-4"
            />
          )}
          <h1
            className="font-black uppercase tracking-[-0.02em] leading-[1.03] text-white [text-wrap:balance] drop-shadow-[0_6px_26px_rgba(0,0,0,0.6)]"
            style={{
              fontSize: "clamp(2.35rem, 6vw, 4.5rem)",
              fontFamily: "var(--global-font, var(--font-montserrat, Montserrat, sans-serif))",
            }}
          >
            {hero.title}
          </h1>
          {hero.subtitle && (
            <p className="mt-4 text-sm sm:text-base md:text-lg font-medium tracking-[0.03em] text-white/85 max-w-2xl leading-relaxed">
              {hero.subtitle}
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-4">
            {hero.ctaPrimaryText && (
              <Link
                href={primaryUrl}
                className="inline-flex items-center gap-2.5 px-9 py-4 text-white font-extrabold text-xs sm:text-sm uppercase tracking-[0.2em] transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--brand-color, #E03E54)" }}
              >
                <span>{hero.ctaPrimaryText}</span>
                <ArrowRight className="size-4" />
              </Link>
            )}
            {hero.ctaSecondaryText && secondaryUrl && (
              <Link
                href={secondaryUrl}
                className="inline-flex items-center px-9 py-4 text-white font-extrabold text-xs sm:text-sm uppercase tracking-[0.2em] border border-white/40 transition-colors hover:bg-white/10"
              >
                {hero.ctaSecondaryText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
