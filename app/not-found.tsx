import type { Metadata } from "next"
import Link from "next/link"
import { ThemeStylesProvider } from "@/components/theme-styles-provider"
import { NotFoundView } from "@/components/not-found-view"

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "The page you are looking for does not exist.",
}

export default function RootNotFound() {
  return (
    <ThemeStylesProvider>
      <div
        className="min-h-screen flex flex-col"
        style={{
          backgroundColor: "var(--global-bg, #000000)",
          color: "var(--text-primary, #FFFFFF)",
        }}
      >
        <header
          className="w-full px-4 md:px-8 py-6 border-b"
          style={{ borderColor: "var(--border-color, #262626)" }}
        >
          <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-8">
            <Link
              href="/"
              className="text-2xl font-black tracking-tight whitespace-nowrap shrink-0"
              style={{
                color: "var(--text-primary, #FFFFFF)",
                fontFamily: "var(--global-font, 'Montserrat', sans-serif)",
              }}
            >
              BUKKAKERY
            </Link>
            <Link
              href="/"
              className="text-sm font-medium whitespace-nowrap shrink-0 transition-opacity hover:opacity-80"
              style={{ color: "var(--text-secondary, #E0E0E0)" }}
            >
              Home
            </Link>
          </div>
        </header>

        <NotFoundView />
      </div>
    </ThemeStylesProvider>
  )
}
