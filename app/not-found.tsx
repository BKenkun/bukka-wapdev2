import type { Metadata } from "next"
import { TopBar } from "@/components/top-bar"
import { MainHeader } from "@/components/main-header"
import { Footer } from "@/components/footer"
import { StickyHeader } from "@/components/sticky-header"
import { DiscountBanner } from "@/components/discount-banner"
import { ThemeStylesProvider } from "@/components/theme-styles-provider"
import { NotFoundView } from "@/components/not-found-view"
import { prisma } from "@/lib/prisma"

export const metadata: Metadata = {
  title: "404 — Page Not Found",
  description: "The page you are looking for does not exist.",
}

async function getThemeSettings(): Promise<Record<string, unknown> | undefined> {
  try {
    const themeSetting = await prisma.siteSettings.findUnique({
      where: { key: "design_theme" },
    })
    if (themeSetting?.value) {
      return themeSetting.value as Record<string, unknown>
    }
    const buttonsSetting = await prisma.siteSettings.findUnique({
      where: { key: "design_buttons" },
    })
    if (buttonsSetting?.value) {
      return { buttons: buttonsSetting.value } as Record<string, unknown>
    }
  } catch {
    // Fallback to default theme tokens
  }
  return undefined
}

export default async function RootNotFound() {
  const initialTheme = await getThemeSettings()

  return (
    <ThemeStylesProvider initialTheme={initialTheme}>
      <div className="min-h-screen flex flex-col">
        <StickyHeader
          topBar={<TopBar />}
          discountBanner={<DiscountBanner />}
        >
          <MainHeader />
        </StickyHeader>
        <NotFoundView />
        <Footer />
      </div>
    </ThemeStylesProvider>
  )
}
