import { getCastingSettings, toPublicCastingSettings } from "@/lib/casting-settings"
import { CastingPageClient } from "./casting-page-client"

export const dynamic = "force-dynamic"

export default async function CastingPage() {
  const settings = await getCastingSettings()
  const publicSettings = toPublicCastingSettings(settings)

  return <CastingPageClient settings={publicSettings} />
}
