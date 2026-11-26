"use client"

import Link from "next/link"
import { Home, Play } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const QUICK_LINKS = [
  { label: "Videos", href: "/videos" },
  { label: "Performers", href: "/performers" },
  { label: "Shop", href: "/shop" },
  { label: "News", href: "/news" },
]

export function NotFoundView() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <main
      className="flex-1 flex flex-col justify-center min-h-[calc(100vh-220px)] px-4 sm:px-6 md:px-8 py-16 md:py-24"
      style={{
        backgroundColor: "var(--global-bg, #000000)",
        color: "var(--text-primary, #FFFFFF)",
        fontFamily: "var(--global-font, 'Montserrat', sans-serif)",
      }}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl mx-auto flex flex-col items-center text-center"
      >
        {/* Clean unboxed editorial metadata */}
        <p
          className="flex items-center gap-2.5 text-xs sm:text-sm font-medium tracking-wide mb-5"
          style={{ color: "var(--text-muted, #999999)" }}
        >
          <span>Error 404</span>
          <span aria-hidden="true">·</span>
          <span>Page not found</span>
        </p>

        {/* Dominant typographic focal anchor */}
        <div
          className="text-[clamp(5.25rem,14vw,9.25rem)] font-black leading-none tracking-tight tabular-nums select-none"
          style={{ color: "var(--text-primary, #FFFFFF)" }}
          aria-hidden="true"
        >
          404
        </div>

        {/* Precision brand hairline rule */}
        <div
          className="h-[2px] w-16 my-7"
          style={{ backgroundColor: "var(--brand-color, #FA4860)" }}
          aria-hidden="true"
        />

        {/* Headline */}
        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-balance mb-4"
          style={{ color: "var(--text-primary, #FFFFFF)" }}
        >
          This page doesn&apos;t exist
        </h1>

        {/* Concise helper copy */}
        <p
          className="text-sm sm:text-base leading-relaxed max-w-md mb-10"
          style={{ color: "var(--text-muted, #999999)" }}
        >
          The page you&apos;re looking for may have been moved, removed, or the
          address might have a typo.
        </p>

        {/* Actions: single clear primary CTA + secondary navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <Link
            href="/"
            className="btn-primary inline-flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 w-full sm:w-auto min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
          >
            <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>

          <Link
            href="/videos"
            className="btn-secondary inline-flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 w-full sm:w-auto min-h-[44px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
          >
            <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Explore Videos</span>
          </Link>
        </div>

        {/* Quiet site navigation links */}
        <nav
          aria-label="Explore sections"
          className="w-full max-w-md mt-14 pt-8 border-t flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
          style={{ borderColor: "var(--border-color, #262626)" }}
        >
          {QUICK_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium whitespace-nowrap shrink-0 transition-opacity duration-150 hover:opacity-100 opacity-75 hover:underline underline-offset-4"
              style={{ color: "var(--text-primary, #FFFFFF)" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </motion.div>
    </main>
  )
}
