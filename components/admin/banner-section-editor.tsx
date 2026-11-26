"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { VideoSelector } from "@/components/admin/video-selector"
import { IconLink, IconFileText } from "@tabler/icons-react"
import { ChevronDown, ChevronUp, RefreshCw, Sparkles, SlidersHorizontal } from "lucide-react"
import {
  getEffectiveBgSource,
  getNormalizedManualVideoIds,
  type BannerBgSource,
  type BannerContentMode,
  type BannerRotationMode,
  type BannerVideoItemContentMode,
  type BannerVideoItemOverride,
  type BannerVideoSource,
  type UnifiedBannerConfig,
} from "@/lib/banner-config"

interface PageOption {
  id: string
  title: string
  slug: string
}

interface TagOption {
  id: string
  name: string
  slug: string
}

interface CategoryOption {
  id: string
  name: string
  slug: string
}

interface SelectedVideoMeta {
  id: string
  title: string
  slug: string
  thumbnailUrl: string | null
  categories?: Array<{ category?: { name?: string } }>
  performers?: Array<{ performer?: { name?: string } }>
}

interface BannerSectionEditorProps {
  sectionType: "HERO" | "CTA_BANNER"
  config: Record<string, unknown>
  pages: PageOption[]
  tags: TagOption[]
  categories: CategoryOption[]
  updateConfig: (key: string, value: unknown) => void
  updateMultipleConfig: (updates: Record<string, unknown>) => void
}

const VIDEO_SOURCE_OPTIONS: Array<{
  value: BannerVideoSource
  label: string
  hint: string
}> = [
  {
    value: "manual",
    label: "Selección manual (1 o varios)",
    hint: "Busca y ordena vídeos exactos; podrás personalizar textos y botones individualmente en cada uno.",
  },
  {
    value: "latest",
    label: "Últimos vídeos",
    hint: "Toma automáticamente los vídeos publicados más recientes.",
  },
  {
    value: "popular",
    label: "Más populares (todos los tiempos)",
    hint: "Vídeos con mayor número total de reproducciones.",
  },
  {
    value: "popular_weekly",
    label: "Más vistos de la semana",
    hint: "Vídeos con más vistas en los últimos 7 días.",
  },
  {
    value: "trending",
    label: "Tendencias",
    hint: "Vídeos recientes con mayor crecimiento de vistas y likes.",
  },
  {
    value: "category",
    label: "Por categoría",
    hint: "Últimos vídeos publicados dentro de una categoría concreta.",
  },
  {
    value: "tag",
    label: "Por tag",
    hint: "Últimos vídeos publicados que contengan un tag concreto.",
  },
]

const ROTATION_OPTIONS: Array<{
  value: BannerRotationMode
  label: string
  description: string
}> = [
  {
    value: "fixed",
    label: "Fijo",
    description: "Muestra siempre el primer vídeo",
  },
  {
    value: "sequential",
    label: "Rotar en orden",
    description: "Cambia al siguiente en cada visita/recarga",
  },
  {
    value: "random",
    label: "Aleatorio",
    description: "Elige uno distinto al anterior al recargar",
  },
]

export function BannerSectionEditor({
  sectionType,
  config: rawConfig,
  pages,
  tags,
  categories,
  updateConfig,
  updateMultipleConfig,
}: BannerSectionEditorProps) {
  const config = rawConfig as UnifiedBannerConfig
  const [activeTab, setActiveTab] = useState("fondo")
  const [selectedVideosMeta, setSelectedVideosMeta] = useState<Record<string, SelectedVideoMeta>>({})
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null)

  const bgSource: BannerBgSource = getEffectiveBgSource(config, sectionType)
  const dbVideoSource: BannerVideoSource = config.dbVideoSource || "manual"
  const rotationMode: BannerRotationMode = config.rotationMode || "fixed"
  const manualVideoIds = getNormalizedManualVideoIds(config)
  const manualIdsKey = manualVideoIds.join(",")
  const videoOverrides = config.videoOverrides || {}

  // Default contentMode: if dbVideo without explicit contentMode, check if legacy custom text exists
  const hasLegacyGlobalText = Boolean(
    config.kicker?.trim() || config.title?.trim() || config.description?.trim() || config.buttonText?.trim()
  )
  const contentMode: BannerContentMode =
    config.contentMode ||
    (bgSource === "dbVideo" && !hasLegacyGlobalText ? "auto" : bgSource === "dbVideo" && config.dbVideoId ? "custom" : "auto")

  const fullHeight =
    sectionType === "HERO"
      ? config.fullHeight !== undefined
        ? Boolean(config.fullHeight)
        : !config.height
      : false

  const effectiveButtonLinkType: "url" | "page" =
    config.buttonLinkType ||
    config.linkType ||
    (config.buttonPageId || config.linkPageId ? "page" : "url")

  const effectiveButtonUrl = (config.buttonUrl ?? config.linkUrl ?? "") as string
  const effectiveButtonPageId = (config.buttonPageId ?? config.linkPageId ?? "") as string

  // Fetch metadata for manually selected videos so per-video override cards display thumbnails & auto defaults
  useEffect(() => {
    if (bgSource !== "dbVideo" || dbVideoSource !== "manual" || !manualIdsKey) {
      return
    }

    let cancelled = false
    fetch(`/api/admin/videos/search?ids=${encodeURIComponent(manualIdsKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data.videos)) return
        const map: Record<string, SelectedVideoMeta> = {}
        for (const v of data.videos as SelectedVideoMeta[]) {
          map[v.id] = v
        }
        setSelectedVideosMeta(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [bgSource, dbVideoSource, manualIdsKey])

  const handleManualVideosChange = (ids: string[]) => {
    // Keep legacy dbVideoId synced with first selected video for backwards compatibility
    const nextOverrides: Record<string, BannerVideoItemOverride> = {}
    for (const id of ids) {
      if (videoOverrides[id]) {
        nextOverrides[id] = videoOverrides[id]
      }
    }
    updateMultipleConfig({
      dbVideoIds: ids,
      dbVideoId: ids[0] || null,
      videoOverrides: nextOverrides,
    })
  }

  const updateVideoOverride = (
    videoId: string,
    patch: Partial<BannerVideoItemOverride>
  ) => {
    const current = videoOverrides[videoId] || {}
    const updated: BannerVideoItemOverride = { ...current, ...patch }
    updateConfig("videoOverrides", {
      ...videoOverrides,
      [videoId]: updated,
    })
  }

  const handleVideoModeChange = (videoId: string, mode: BannerVideoItemContentMode) => {
    const meta = selectedVideosMeta[videoId]
    const current = videoOverrides[videoId] || {}

    if (mode === "custom") {
      const firstCategory = meta?.categories?.[0]?.category?.name || ""
      const performers = (meta?.performers || [])
        .map((p) => p.performer?.name)
        .filter(Boolean)
        .join(" & ")
      updateVideoOverride(videoId, {
        contentMode: "custom",
        kicker:
          current.kicker ??
          (firstCategory ? `NEW SCENE | ${firstCategory.toUpperCase()}` : "NEW SCENE"),
        title: current.title ?? (performers || meta?.title || ""),
        description: current.description ?? (performers ? meta?.title || "" : ""),
        buttonText: current.buttonText ?? "WATCH NOW",
        buttonUrl: current.buttonUrl ?? (meta?.slug ? `/videos/${meta.slug}` : ""),
        buttonLinkType: current.buttonLinkType ?? "url",
      })
      setExpandedVideoId(videoId)
    } else {
      updateVideoOverride(videoId, { contentMode: mode })
      if (expandedVideoId === videoId && !current.customEffects) {
        setExpandedVideoId(null)
      }
    }
  }

  const activeSourceMeta = VIDEO_SOURCE_OPTIONS.find((o) => o.value === dbVideoSource)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="fondo">Fondo</TabsTrigger>
        <TabsTrigger value="contenido">Contenido</TabsTrigger>
        <TabsTrigger value="estilo">Estilo</TabsTrigger>
      </TabsList>

      {/* ==================== TAB 1: FONDO ==================== */}
      <TabsContent value="fondo" className="space-y-5 mt-4">
        <div className="space-y-2">
          <Label>Fuente del fondo</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "image", label: "Imagen" },
                { value: "uploadedVideo", label: "Video subido" },
                { value: "dbVideo", label: "Vídeo de la web" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={bgSource === option.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => updateConfig("bgSource", option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Image background */}
        {bgSource === "image" && (
          <div className="space-y-2">
            <Label>Imagen de fondo</Label>
            <FileDropzone
              value={(config.backgroundImage as string) || null}
              onChange={(url) => updateConfig("backgroundImage", url || "")}
              accept="image"
              folder={sectionType === "HERO" ? "hero" : "cta"}
              placeholder="Arrastra una imagen de fondo aquí"
            />
          </div>
        )}

        {/* Uploaded video background */}
        {bgSource === "uploadedVideo" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Video de fondo</Label>
              <FileDropzone
                value={(config.videoUrl as string) || null}
                onChange={(url) => updateConfig("videoUrl", url || "")}
                accept="video"
                folder={sectionType === "HERO" ? "hero" : "cta"}
                placeholder="Arrastra un video aquí (autoplay, sin sonido)"
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen póster de respaldo (opcional)</Label>
              <FileDropzone
                value={(config.backgroundImage as string) || null}
                onChange={(url) => updateConfig("backgroundImage", url || "")}
                accept="image"
                folder={sectionType === "HERO" ? "hero" : "cta"}
                placeholder="Se muestra mientras el video carga"
              />
            </div>
          </div>
        )}

        {/* DB Video background (Manual or Automatic + Rotation + Per-Video Overrides) */}
        {bgSource === "dbVideo" && (
          <div className="space-y-4">
            {/* Video Source Selector */}
            <div className="space-y-2">
              <Label htmlFor="bannerDbVideoSource">Fuente de vídeos</Label>
              <Select
                value={dbVideoSource}
                onValueChange={(value) => updateConfig("dbVideoSource", value)}
              >
                <SelectTrigger id="bannerDbVideoSource">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIDEO_SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeSourceMeta && (
                <p className="text-xs text-muted-foreground">{activeSourceMeta.hint}</p>
              )}
            </div>

            {/* Category selector when source === category */}
            {dbVideoSource === "category" && (
              <div className="space-y-2">
                <Label>Categoría</Label>
                {categories.length > 0 ? (
                  <Select
                    value={(config.dbCategorySlug as string) || ""}
                    onValueChange={(value) => updateConfig("dbCategorySlug", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={(config.dbCategorySlug as string) || ""}
                    onChange={(e) => updateConfig("dbCategorySlug", e.target.value)}
                    placeholder="Slug de categoría (ej: glory-hole)"
                  />
                )}
              </div>
            )}

            {/* Tag selector when source === tag */}
            {dbVideoSource === "tag" && (
              <div className="space-y-2">
                <Label>Tag</Label>
                {tags.length > 0 ? (
                  <Select
                    value={(config.dbTagSlug as string) || ""}
                    onValueChange={(value) => updateConfig("dbTagSlug", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((tag) => (
                        <SelectItem key={tag.id} value={tag.slug}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No hay tags disponibles. Crea tags en Admin → Tags.
                  </p>
                )}
              </div>
            )}

            {/* Rotation Mode */}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex items-center gap-2">
                <RefreshCw className="size-4 text-muted-foreground" />
                <Label>Comportamiento y rotación</Label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ROTATION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={rotationMode === opt.value ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => updateConfig("rotationMode", opt.value)}
                    className="h-auto py-2 px-2.5 flex flex-col items-start text-left"
                  >
                    <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground font-normal leading-tight mt-0.5 whitespace-normal">
                      {opt.description}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Pool size when automatic + rotating */}
            {dbVideoSource !== "manual" && rotationMode !== "fixed" && (
              <div className="space-y-2">
                <Label htmlFor="dbVideoLimit">Tamaño del pool en rotación</Label>
                <Select
                  value={String(config.dbVideoLimit || 6)}
                  onValueChange={(value) => updateConfig("dbVideoLimit", parseInt(value, 10))}
                >
                  <SelectTrigger id="dbVideoLimit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Top 3 vídeos</SelectItem>
                    <SelectItem value="5">Top 5 vídeos</SelectItem>
                    <SelectItem value="6">Top 6 vídeos</SelectItem>
                    <SelectItem value="10">Top 10 vídeos</SelectItem>
                    <SelectItem value="15">Top 15 vídeos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cada vez que un usuario entre o recargue la Home rotará entre estos vídeos.
                </p>
              </div>
            )}

            {/* Manual multi-video selector */}
            {dbVideoSource === "manual" && (
              <div className="space-y-3 pt-2 border-t">
                <div className="space-y-1">
                  <Label>
                    {rotationMode === "fixed"
                      ? "Seleccionar vídeo"
                      : "Secuencia de vídeos (añade varios para rotar)"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Busca uno o varios vídeos y ordénalos arrastrando. Debajo puedes definir si cada vídeo usa su información automática o textos/botón personalizados.
                  </p>
                </div>

                <VideoSelector
                  value={manualVideoIds}
                  onChange={handleManualVideosChange}
                  placeholder="Buscar vídeo por título o slug..."
                />

                {/* Per-video info & CTA customization list */}
                {manualVideoIds.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Información y botones por vídeo ({manualVideoIds.length})
                      </Label>
                    </div>

                    <div className="space-y-2">
                      {manualVideoIds.map((vid, idx) => {
                        const meta = selectedVideosMeta[vid]
                        const override = videoOverrides[vid] || {}
                        const itemMode: BannerVideoItemContentMode =
                          override.contentMode || (contentMode === "custom" ? "inherit" : "auto")
                        const isExpanded = expandedVideoId === vid
                        const firstCat = meta?.categories?.[0]?.category?.name

                        return (
                          <div
                            key={vid}
                            className="rounded-md border border-border bg-card/60 overflow-hidden"
                          >
                            {/* Compact row header */}
                            <div className="flex flex-wrap items-center gap-2.5 p-2.5">
                              <span className="text-xs font-mono tabular-nums text-muted-foreground w-5 text-center">
                                #{idx + 1}
                              </span>

                              {meta?.thumbnailUrl && (
                                <img
                                  src={meta.thumbnailUrl}
                                  alt={meta.title}
                                  className="w-12 h-8 object-cover rounded shrink-0 bg-muted"
                                />
                              )}

                              <div className="flex-1 min-w-[130px]">
                                <p className="text-xs font-medium truncate">
                                  {meta?.title || vid}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {firstCat ? `${firstCat} · ` : ""}
                                  {itemMode === "auto"
                                    ? "Info automática del vídeo"
                                    : itemMode === "inherit"
                                      ? "Usa el contenido global del banner"
                                      : "Textos/botón personalizados"}
                                  {override.customEffects ? " · Efectos propios" : ""}
                                </p>
                              </div>

                              {/* Mode selector per video */}
                              <div className="flex items-center gap-1 shrink-0">
                                {(
                                  [
                                    { value: "auto", label: "Auto" },
                                    { value: "inherit", label: "Banner" },
                                    { value: "custom", label: "Custom" },
                                  ] as const
                                ).map((modeBtn) => (
                                  <Button
                                    key={modeBtn.value}
                                    type="button"
                                    size="sm"
                                    variant={itemMode === modeBtn.value ? "secondary" : "ghost"}
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => handleVideoModeChange(vid, modeBtn.value)}
                                  >
                                    {modeBtn.label}
                                  </Button>
                                ))}

                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  title="Ajustes avanzados de este vídeo"
                                  onClick={() => setExpandedVideoId(isExpanded ? null : vid)}
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="size-3.5" />
                                  ) : (
                                    <ChevronDown className="size-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            {/* Expandable per-video override editor */}
                            {isExpanded && (
                              <div className="p-3 pt-3 border-t border-border bg-muted/20 space-y-3">
                                {itemMode === "custom" ? (
                                  <>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Etiqueta superior / Kicker</Label>
                                      <Input
                                        value={override.kicker || ""}
                                        onChange={(e) =>
                                          updateVideoOverride(vid, { kicker: e.target.value })
                                        }
                                        placeholder="NEW SCENE | CATEGORY"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Título</Label>
                                      <Input
                                        value={override.title || ""}
                                        onChange={(e) =>
                                          updateVideoOverride(vid, { title: e.target.value })
                                        }
                                        placeholder="OPEN CASTING"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label className="text-xs">Descripción</Label>
                                      <Textarea
                                        value={override.description || ""}
                                        onChange={(e) =>
                                          updateVideoOverride(vid, { description: e.target.value })
                                        }
                                        placeholder="CUM WITH US"
                                        rows={2}
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Texto del botón</Label>
                                        <Input
                                          value={override.buttonText || ""}
                                          onChange={(e) =>
                                            updateVideoOverride(vid, { buttonText: e.target.value })
                                          }
                                          placeholder="DO THE CASTING NOW"
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <Label className="text-xs">Destino del botón</Label>
                                        <div className="flex gap-1">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                              (override.buttonLinkType || "url") === "url"
                                                ? "secondary"
                                                : "outline"
                                            }
                                            className="h-9 px-2 text-xs flex-1"
                                            onClick={() =>
                                              updateVideoOverride(vid, {
                                                buttonLinkType: "url",
                                                buttonPageId: null,
                                              })
                                            }
                                          >
                                            URL
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={
                                              override.buttonLinkType === "page"
                                                ? "secondary"
                                                : "outline"
                                            }
                                            className="h-9 px-2 text-xs flex-1"
                                            onClick={() =>
                                              updateVideoOverride(vid, {
                                                buttonLinkType: "page",
                                                buttonUrl: "",
                                              })
                                            }
                                          >
                                            Página
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    {override.buttonLinkType === "page" ? (
                                      <Select
                                        value={override.buttonPageId || ""}
                                        onValueChange={(value) =>
                                          updateVideoOverride(vid, { buttonPageId: value })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecciona una página interna" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {pages.map((page) => (
                                            <SelectItem key={page.id} value={page.id}>
                                              {page.title}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        value={override.buttonUrl || ""}
                                        onChange={(e) =>
                                          updateVideoOverride(vid, { buttonUrl: e.target.value })
                                        }
                                        placeholder="https://bukkakery.com/casting o /videos/slug"
                                      />
                                    )}

                                    <div className="flex items-center justify-between pt-1">
                                      <Label className="text-xs text-muted-foreground">
                                        Abrir enlace en nueva pestaña
                                      </Label>
                                      <Switch
                                        checked={Boolean(override.openInNewTab)}
                                        onCheckedChange={(checked) =>
                                          updateVideoOverride(vid, { openInNewTab: checked })
                                        }
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">
                                    {itemMode === "auto"
                                      ? "Este vídeo rellenará automáticamente el kicker, título, descripción y enlace a su propia página. Cambia a \"Custom\" si quieres textos o botón específicos para este vídeo."
                                      : "Este vídeo heredará el título, descripción y botón configurados en la pestaña Contenido."}
                                  </p>
                                )}

                                {/* Optional per-video overlay & blur override */}
                                <div className="pt-2 border-t border-border space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                                      <Label className="text-xs font-medium">
                                        Oscurecer / Difuminar propios para este vídeo
                                      </Label>
                                    </div>
                                    <Switch
                                      checked={Boolean(override.customEffects)}
                                      onCheckedChange={(checked) =>
                                        updateVideoOverride(vid, {
                                          customEffects: checked,
                                          ...(checked
                                            ? {
                                                overlayEnabled:
                                                  override.overlayEnabled ??
                                                  (config.overlayEnabled ?? true),
                                                overlayOpacity:
                                                  override.overlayOpacity ??
                                                  (config.overlayOpacity ?? 0.5),
                                                overlayColor:
                                                  override.overlayColor ??
                                                  (config.overlayColor || "#000000"),
                                                blurEnabled:
                                                  override.blurEnabled ??
                                                  Boolean(config.blurEnabled),
                                                blurIntensity:
                                                  override.blurIntensity ??
                                                  (config.blurIntensity ?? 4),
                                              }
                                            : {}),
                                        })
                                      }
                                    />
                                  </div>

                                  {override.customEffects && (
                                    <div className="space-y-3 pl-1">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Oscurecer el fondo</Label>
                                        <Switch
                                          checked={override.overlayEnabled ?? true}
                                          onCheckedChange={(checked) =>
                                            updateVideoOverride(vid, { overlayEnabled: checked })
                                          }
                                        />
                                      </div>
                                      {(override.overlayEnabled ?? true) && (
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-muted-foreground tabular-nums">
                                            Opacidad ({(override.overlayOpacity ?? 0.5).toFixed(2)})
                                          </Label>
                                          <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={override.overlayOpacity ?? 0.5}
                                            onChange={(e) =>
                                              updateVideoOverride(vid, {
                                                overlayOpacity: parseFloat(e.target.value),
                                              })
                                            }
                                            className="w-full accent-primary"
                                          />
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Difuminar el fondo</Label>
                                        <Switch
                                          checked={Boolean(override.blurEnabled)}
                                          onCheckedChange={(checked) =>
                                            updateVideoOverride(vid, { blurEnabled: checked })
                                          }
                                        />
                                      </div>
                                      {override.blurEnabled && (
                                        <div className="space-y-1">
                                          <Label className="text-[11px] text-muted-foreground tabular-nums">
                                            Intensidad ({override.blurIntensity ?? 4}px)
                                          </Label>
                                          <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            step="1"
                                            value={override.blurIntensity ?? 4}
                                            onChange={(e) =>
                                              updateVideoOverride(vid, {
                                                blurIntensity: parseInt(e.target.value, 10),
                                              })
                                            }
                                            className="w-full accent-primary"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Global Overlay controls */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`overlayEnabled-${sectionType}`}>Overlay oscuro</Label>
              <p className="text-xs text-muted-foreground">
                Oscurecer el fondo para mejorar la legibilidad
              </p>
            </div>
            <Switch
              id={`overlayEnabled-${sectionType}`}
              checked={(config.overlayEnabled as boolean) ?? (sectionType === "CTA_BANNER")}
              onCheckedChange={(checked) => updateConfig("overlayEnabled", checked)}
            />
          </div>
          {((config.overlayEnabled as boolean) ?? (sectionType === "CTA_BANNER")) && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor={`overlayOpacity-${sectionType}`} className="tabular-nums">
                  Intensidad del overlay ({((config.overlayOpacity as number) ?? 0.5).toFixed(2)})
                </Label>
                <input
                  id={`overlayOpacity-${sectionType}`}
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={(config.overlayOpacity as number) ?? 0.5}
                  onChange={(e) => updateConfig("overlayOpacity", parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0 (sin overlay)</span>
                  <span>1 (opaco total)</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Color del overlay superpuesto</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={(config.overlayColor as string) || "#000000"}
                    onChange={(e) => updateConfig("overlayColor", e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={(config.overlayColor as string) || "#000000"}
                    onChange={(e) => updateConfig("overlayColor", e.target.value)}
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global Blur controls */}
        <div className="space-y-3 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={`blurEnabled-${sectionType}`}>Desenfoque</Label>
              <p className="text-xs text-muted-foreground">
                Difuminar el fondo para destacar el contenido
              </p>
            </div>
            <Switch
              id={`blurEnabled-${sectionType}`}
              checked={(config.blurEnabled as boolean) ?? false}
              onCheckedChange={(checked) => updateConfig("blurEnabled", checked)}
            />
          </div>
          {!!config.blurEnabled && (
            <div className="space-y-2">
              <Label htmlFor={`blurIntensity-${sectionType}`} className="tabular-nums">
                Intensidad ({(config.blurIntensity as number) ?? 4}px)
              </Label>
              <input
                id={`blurIntensity-${sectionType}`}
                type="range"
                min="1"
                max="20"
                step="1"
                value={(config.blurIntensity as number) ?? 4}
                onChange={(e) => updateConfig("blurIntensity", parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1px (sutil)</span>
                <span>20px (muy difuso)</span>
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      {/* ==================== TAB 2: CONTENIDO ==================== */}
      <TabsContent value="contenido" className="space-y-4 mt-4">
        {bgSource === "dbVideo" && (
          <div className="space-y-3 p-3.5 rounded-md border border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">
                Origen de textos y botón por defecto
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={contentMode === "auto" ? "secondary" : "outline"}
                onClick={() => updateConfig("contentMode", "auto")}
                className="h-auto py-2 flex flex-col items-start text-left"
              >
                <span className="text-xs font-semibold">Automático del vídeo</span>
                <span className="text-[11px] text-muted-foreground font-normal whitespace-normal mt-0.5">
                  Rellena categoría, actriz, título y enlace del vídeo
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={contentMode === "custom" ? "secondary" : "outline"}
                onClick={() => updateConfig("contentMode", "custom")}
                className="h-auto py-2 flex flex-col items-start text-left"
              >
                <span className="text-xs font-semibold">Personalizado del banner</span>
                <span className="text-[11px] text-muted-foreground font-normal whitespace-normal mt-0.5">
                  Usa textos y botón fijos (ej. Open Casting)
                </span>
              </Button>
            </div>
            {dbVideoSource === "manual" && (
              <p className="text-xs text-muted-foreground">
                En selección manual, cada vídeo también puede sobrescribir este modo individualmente desde la pestaña Fondo.
              </p>
            )}
          </div>
        )}

        {/* Auto-mode optional defaults */}
        {bgSource === "dbVideo" && contentMode === "auto" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`autoKickerPrefix-${sectionType}`}>
                Prefijo del kicker (opcional)
              </Label>
              <Input
                id={`autoKickerPrefix-${sectionType}`}
                value={(config.autoKickerPrefix as string) || ""}
                onChange={(e) => updateConfig("autoKickerPrefix", e.target.value)}
                placeholder="NEW SCENE (automático si vacío)"
              />
              <p className="text-xs text-muted-foreground">
                Se combina con la categoría: EJ. NEW SCENE | GLORY HOLE
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`autoButtonText-${sectionType}`}>
                Texto del botón por defecto
              </Label>
              <Input
                id={`autoButtonText-${sectionType}`}
                value={(config.autoButtonText as string) || ""}
                onChange={(e) => updateConfig("autoButtonText", e.target.value)}
                placeholder="WATCH NOW"
              />
              <p className="text-xs text-muted-foreground">
                Enlazará automáticamente a la página de cada vídeo.
              </p>
            </div>
          </div>
        )}

        {/* Custom banner content fields (always shown for image/uploadedVideo, or when contentMode === custom, or available as banner-level fallback for manual inherit) */}
        {(bgSource !== "dbVideo" || contentMode === "custom") && (
          <>
            <div className="space-y-2">
              <Label htmlFor={`bannerKicker-${sectionType}`}>
                Etiqueta superior / Kicker (opcional)
              </Label>
              <Input
                id={`bannerKicker-${sectionType}`}
                value={(config.kicker as string) || ""}
                onChange={(e) => updateConfig("kicker", e.target.value)}
                placeholder="NEW SCENE | CATEGORY"
              />
              <p className="text-xs text-muted-foreground">
                Usa &quot;|&quot; para separar el rótulo destacado y la categoría (ej: NEW SCENE | HARDCORE).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`bannerTitle-${sectionType}`}>Título del banner</Label>
              <Input
                id={`bannerTitle-${sectionType}`}
                value={(config.title as string) || ""}
                onChange={(e) => updateConfig("title", e.target.value)}
                placeholder="OPEN CASTING"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`bannerDesc-${sectionType}`}>Descripción</Label>
              <Textarea
                id={`bannerDesc-${sectionType}`}
                value={(config.description as string) || ""}
                onChange={(e) => updateConfig("description", e.target.value)}
                placeholder="CUM WITH US"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`bannerBtnText-${sectionType}`}>
                Texto del botón {sectionType === "HERO" ? "(opcional)" : ""}
              </Label>
              <Input
                id={`bannerBtnText-${sectionType}`}
                value={(config.buttonText as string) || ""}
                onChange={(e) => updateConfig("buttonText", e.target.value)}
                placeholder="DO THE CASTING NOW"
              />
              {sectionType === "HERO" && (
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacío y configuras un enlace debajo, todo el Hero funcionará como enlace clicable.
                </p>
              )}
            </div>

            {/* Button / Banner Destination Link */}
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-medium">Enlace del botón</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={effectiveButtonLinkType === "page" ? "outline" : "secondary"}
                  className="justify-start"
                  onClick={() =>
                    updateMultipleConfig({
                      buttonLinkType: "url",
                      linkType: "url",
                      buttonPageId: null,
                      linkPageId: null,
                    })
                  }
                >
                  <IconLink className="mr-2 size-4" />
                  URL personalizada
                </Button>
                <Button
                  type="button"
                  variant={effectiveButtonLinkType === "page" ? "secondary" : "outline"}
                  className="justify-start"
                  onClick={() =>
                    updateMultipleConfig({
                      buttonLinkType: "page",
                      linkType: "page",
                      buttonUrl: "",
                      linkUrl: null,
                    })
                  }
                >
                  <IconFileText className="mr-2 size-4" />
                  Página interna
                </Button>
              </div>

              {effectiveButtonLinkType === "page" ? (
                <div className="space-y-2">
                  <Label>Página</Label>
                  {pages.length > 0 ? (
                    <Select
                      value={effectiveButtonPageId}
                      onValueChange={(value) =>
                        updateMultipleConfig({
                          buttonPageId: value,
                          linkPageId: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una página" />
                      </SelectTrigger>
                      <SelectContent>
                        {pages.map((page) => (
                          <SelectItem key={page.id} value={page.id}>
                            {page.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No hay páginas publicadas disponibles
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`bannerBtnUrl-${sectionType}`}>URL</Label>
                  <Input
                    id={`bannerBtnUrl-${sectionType}`}
                    value={effectiveButtonUrl}
                    onChange={(e) =>
                      updateMultipleConfig({
                        buttonUrl: e.target.value,
                        linkUrl: e.target.value,
                      })
                    }
                    placeholder="https://bukkakery.com/casting o /videos"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div>
                  <Label htmlFor={`openInNewTab-${sectionType}`}>Abrir en nueva pestaña</Label>
                  <p className="text-xs text-muted-foreground">
                    El enlace se abrirá en una nueva ventana
                  </p>
                </div>
                <Switch
                  id={`openInNewTab-${sectionType}`}
                  checked={Boolean(config.openInNewTab)}
                  onCheckedChange={(checked) => updateConfig("openInNewTab", checked)}
                />
              </div>
            </div>
          </>
        )}
      </TabsContent>

      {/* ==================== TAB 3: ESTILO ==================== */}
      <TabsContent value="estilo" className="space-y-4 mt-4">
        {/* Hero Full-Screen Height Toggle */}
        {sectionType === "HERO" && (
          <div className="flex items-center justify-between pb-3 border-b">
            <div>
              <Label htmlFor="heroFullHeight">Pantalla completa (100vh)</Label>
              <p className="text-xs text-muted-foreground">
                Ocupa todo el alto de la pantalla. Desactívalo para definir una altura en píxeles.
              </p>
            </div>
            <Switch
              id="heroFullHeight"
              checked={fullHeight}
              onCheckedChange={(checked) => updateConfig("fullHeight", checked)}
            />
          </div>
        )}

        {/* Height slider */}
        {(!fullHeight || sectionType === "CTA_BANNER") && (
          <div className="space-y-2">
            <Label htmlFor={`bannerHeight-${sectionType}`} className="tabular-nums">
              Altura del banner ({(config.height as number) || (sectionType === "HERO" ? 720 : 486)}px)
            </Label>
            <input
              id={`bannerHeight-${sectionType}`}
              type="range"
              min="200"
              max="950"
              step="10"
              value={(config.height as number) || (sectionType === "HERO" ? 720 : 486)}
              onChange={(e) => updateConfig("height", parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>200px</span>
              <span>950px</span>
            </div>
          </div>
        )}

        {/* Content position */}
        <div className="space-y-2 pt-4 border-t">
          <Label>Posición del contenido</Label>
          <div className="grid grid-cols-3 gap-1 w-[180px]">
            {[
              { value: "top-left", label: "↖" },
              { value: "top-center", label: "↑" },
              { value: "top-right", label: "↗" },
              { value: "center-left", label: "←" },
              { value: "center", label: "●" },
              { value: "center-right", label: "→" },
              { value: "bottom-left", label: "↙" },
              { value: "bottom-center", label: "↓" },
              { value: "bottom-right", label: "↘" },
            ].map((pos) => (
              <Button
                key={pos.value}
                type="button"
                variant={((config.contentPosition as string) || "center") === pos.value ? "secondary" : "outline"}
                size="sm"
                className="h-10 text-lg"
                onClick={() => updateConfig("contentPosition", pos.value)}
              >
                {pos.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Title typography */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium">Tipografía del título</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Fuente</Label>
              <Select
                value={(config.titleFontFamily as string) || "Montserrat"}
                onValueChange={(value) => updateConfig("titleFontFamily", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                  <SelectItem value="Oswald">Oswald</SelectItem>
                  <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`titleFontSize-${sectionType}`} className="text-xs text-muted-foreground">
                Tamaño (px)
              </Label>
              <Input
                id={`titleFontSize-${sectionType}`}
                type="number"
                min={16}
                max={96}
                value={(config.titleFontSize as number) || (sectionType === "HERO" ? 56 : 40)}
                onChange={(e) => updateConfig("titleFontSize", parseInt(e.target.value, 10) || 40)}
              />
            </div>
          </div>
        </div>

        {/* Button colors */}
        <div className="space-y-3 pt-4 border-t">
          <Label className="text-sm font-medium">Colores del botón</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Fondo</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(config.buttonBgColor as string) || "#FA4860"}
                  onChange={(e) => updateConfig("buttonBgColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={(config.buttonBgColor as string) || "#FA4860"}
                  onChange={(e) => updateConfig("buttonBgColor", e.target.value)}
                  placeholder="#FA4860"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Fondo hover</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(config.buttonHoverColor as string) || "#e03e54"}
                  onChange={(e) => updateConfig("buttonHoverColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={(config.buttonHoverColor as string) || "#e03e54"}
                  onChange={(e) => updateConfig("buttonHoverColor", e.target.value)}
                  placeholder="#e03e54"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Texto</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(config.buttonTextColor as string) || "#FFFFFF"}
                  onChange={(e) => updateConfig("buttonTextColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={(config.buttonTextColor as string) || "#FFFFFF"}
                  onChange={(e) => updateConfig("buttonTextColor", e.target.value)}
                  placeholder="#FFFFFF"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Texto hover</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={(config.buttonHoverTextColor as string) || "#FFFFFF"}
                  onChange={(e) => updateConfig("buttonHoverTextColor", e.target.value)}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={(config.buttonHoverTextColor as string) || "#FFFFFF"}
                  onChange={(e) => updateConfig("buttonHoverTextColor", e.target.value)}
                  placeholder="#FFFFFF"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
