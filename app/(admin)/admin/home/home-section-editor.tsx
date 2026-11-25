"use client"

import { useState } from "react"
import { HomeSectionType } from "@prisma/client"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { IconLink, IconFileText } from "@tabler/icons-react"
import { VideoSelector } from "@/components/admin/video-selector"
import { MuxVideoPlayer } from "@/components/mux-video-player"
import { Badge } from "@/components/ui/badge"
import { toDateTimeLocalInput } from "@/lib/banner-utils"

interface HomeSection {
  id: string
  type: HomeSectionType
  title: string | null
  enabled: boolean
  order: number
  config: Record<string, unknown> | null
}

interface Page {
  id: string
  title: string
  slug: string
}

interface Tag {
  id: string
  name: string
  slug: string
}

interface HomeSectionEditorProps {
  section: HomeSection
  pages: Page[]
  tags: Tag[]
  onSave: (id: string, data: Partial<HomeSection>) => Promise<void>
  onClose: () => void
}

export function HomeSectionEditor({ section, pages, tags, onSave, onClose }: HomeSectionEditorProps) {
  const [title, setTitle] = useState(section.title || "")
  const [config, setConfig] = useState<Record<string, unknown>>(
    (section.config as Record<string, unknown>) || {}
  )
  const [isSaving, setIsSaving] = useState(false)
  const [ctaTab, setCtaTab] = useState("fondo")
  const [countdownTab, setCountdownTab] = useState("contenido")

  const countdownMode: "auto" | "manual" =
    (config.mode as "auto" | "manual") ||
    (config.videoId ? "auto" : config.targetDate ? "manual" : "auto")

  const handleSave = async () => {
    setIsSaving(true)
    await onSave(section.id, {
      title: title || null,
      config,
    })
    setIsSaving(false)
  }

  const updateConfig = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const updateMultipleConfig = (updates: Record<string, unknown>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle>Editar Sección: {section.type}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title (for sections that have it) */}
          {section.type !== "HERO" && section.type !== "CTA_BANNER" && section.type !== "COUNTDOWN" && (
            <div className="space-y-2">
              <Label htmlFor="title">Título de la sección</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título que se mostrará encima de la sección"
              />
            </div>
          )}

          {/* HERO Config */}
          {section.type === "HERO" && (
            <>
              <div className="space-y-2">
                <Label>Imagen de fondo</Label>
                <FileDropzone
                  value={(config.backgroundImage as string) || null}
                  onChange={(url) => updateConfig("backgroundImage", url || "")}
                  accept="image"
                  folder="hero"
                  placeholder="Arrastra una imagen de fondo aquí"
                />
                <p className="text-xs text-muted-foreground">
                  Se usará como fondo si no hay video configurado
                </p>
              </div>
              <div className="space-y-2">
                <Label>Video de fondo (opcional)</Label>
                <FileDropzone
                  value={(config.videoUrl as string) || null}
                  onChange={(url) => updateConfig("videoUrl", url || "")}
                  accept="video"
                  folder="hero"
                  placeholder="Arrastra un video aquí para usarlo como fondo"
                />
                <p className="text-xs text-muted-foreground">
                  Si se sube un video, se mostrará en lugar de la imagen
                </p>
              </div>

              {/* Link Configuration */}
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-base font-medium">Enlace (opcional)</Label>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Tipo de enlace</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={config.linkType === "page" ? "outline" : "secondary"}
                      className="justify-start"
                      onClick={() => {
                        updateMultipleConfig({
                          linkType: "url",
                          linkPageId: null,
                        })
                      }}
                    >
                      <IconLink className="mr-2 size-4" />
                      URL personalizada
                    </Button>
                    <Button
                      type="button"
                      variant={config.linkType === "page" ? "secondary" : "outline"}
                      className="justify-start"
                      onClick={() => {
                        updateMultipleConfig({
                          linkType: "page",
                          linkUrl: null,
                        })
                      }}
                    >
                      <IconFileText className="mr-2 size-4" />
                      Página interna
                    </Button>
                  </div>
                </div>

                {config.linkType === "page" ? (
                  <div className="space-y-2">
                    <Label>Página</Label>
                    {pages.length > 0 ? (
                      <Select
                        value={(config.linkPageId as string) || ""}
                        onValueChange={(value) => updateConfig("linkPageId", value)}
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
                    <Label htmlFor="linkUrl">URL</Label>
                    <Input
                      id="linkUrl"
                      value={(config.linkUrl as string) || ""}
                      onChange={(e) => updateConfig("linkUrl", e.target.value)}
                      placeholder="https://... o /ruta-interna"
                    />
                    <p className="text-xs text-muted-foreground">
                      Introduce una URL externa (https://...) o una ruta interna (/videos)
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="openInNewTab">Abrir en nueva pestaña</Label>
                    <p className="text-xs text-muted-foreground">
                      El enlace se abrirá en una nueva ventana
                    </p>
                  </div>
                  <Switch
                    id="openInNewTab"
                    checked={(config.openInNewTab as boolean) || false}
                    onCheckedChange={(checked) => updateConfig("openInNewTab", checked)}
                  />
                </div>
              </div>
            </>
          )}

          {/* VIDEO_GRID Config */}
          {section.type === "VIDEO_GRID" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="source">Fuente de videos</Label>
                <Select
                  value={(config.source as string) || "latest"}
                  onValueChange={(value) => updateConfig("source", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Últimos videos</SelectItem>
                    <SelectItem value="popular">Más populares (todos)</SelectItem>
                    <SelectItem value="popular_weekly">Más vistos de la semana</SelectItem>
                    <SelectItem value="trending">Tendencias</SelectItem>
                    <SelectItem value="category">Por categoría</SelectItem>
                    <SelectItem value="tag">Por tag</SelectItem>
                    <SelectItem value="manual">Selección manual</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {config.source === "popular_weekly" && "Vídeos más vistos en los últimos 7 días"}
                  {config.source === "trending" && "Vídeos con mayor crecimiento de vistas reciente"}
                  {config.source === "tag" && "Vídeos que tengan el tag seleccionado"}
                </p>
              </div>

              {config.source === "category" && (
                <div className="space-y-2">
                  <Label htmlFor="categorySlug">Slug de categoría</Label>
                  <Input
                    id="categorySlug"
                    value={(config.categorySlug as string) || ""}
                    onChange={(e) => updateConfig("categorySlug", e.target.value)}
                    placeholder="bukkake"
                  />
                </div>
              )}

              {config.source === "tag" && (
                <div className="space-y-2">
                  <Label>Tag</Label>
                  {tags.length > 0 ? (
                    <Select
                      value={(config.tagSlug as string) || ""}
                      onValueChange={(value) => updateConfig("tagSlug", value)}
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
                    <p className="text-sm text-muted-foreground">
                      No hay tags disponibles. Crea tags en Admin → Tags
                    </p>
                  )}
                </div>
              )}

              {config.source === "manual" && (
                <div className="space-y-2">
                  <Label>Seleccionar videos</Label>
                  <VideoSelector
                    value={Array.isArray(config.videoIds) ? (config.videoIds as string[]) : []}
                    onChange={(ids) => updateConfig("videoIds", ids)}
                    placeholder="Buscar videos por título..."
                  />
                </div>
              )}

              {/* Modo de visualización: carrusel u cuadrícula */}
              <div className="space-y-2">
                <Label htmlFor="displayMode">Visualización</Label>
                <Select
                  value={(config.displayMode as string) || "carousel"}
                  onValueChange={(value) => updateConfig("displayMode", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carousel">Carrusel (scroll horizontal)</SelectItem>
                    <SelectItem value="grid">Cuadrícula (grid fijo)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  La cuadrícula muestra todos los videos a la vez; útil para destacar una categoría.
                </p>
              </div>

              <div className={config.source === "manual" ? "" : "grid grid-cols-2 gap-4"}>
                {config.source !== "manual" && (
                  <div className="space-y-2">
                    <Label htmlFor="limit">Número de videos</Label>
                    <Select
                      value={String((config.limit as number) || 6)}
                      onValueChange={(value) => updateConfig("limit", parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 videos</SelectItem>
                        <SelectItem value="6">6 videos</SelectItem>
                        <SelectItem value="9">9 videos</SelectItem>
                        <SelectItem value="12">12 videos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="columns">Columnas (en cuadrícula)</Label>
                  <Select
                    value={String((config.columns as number) || 3)}
                    onValueChange={(value) => updateConfig("columns", parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 columnas</SelectItem>
                      <SelectItem value="3">3 columnas</SelectItem>
                      <SelectItem value="4">4 columnas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* ACTRESS_GRID Config */}
          {section.type === "ACTRESS_GRID" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="source">Fuente de modelos</Label>
                <Select
                  value={(config.source as string) || "featured"}
                  onValueChange={(value) => updateConfig("source", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Destacadas</SelectItem>
                    <SelectItem value="popular">Más populares</SelectItem>
                    <SelectItem value="latest">Más recientes</SelectItem>
                    <SelectItem value="manual">Selección manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.source === "manual" && (
                <div className="space-y-2">
                  <Label htmlFor="performerIds">IDs de modelos (separados por coma)</Label>
                  <Textarea
                    id="performerIds"
                    value={
                      Array.isArray(config.performerIds)
                        ? (config.performerIds as string[]).join(", ")
                        : ""
                    }
                    onChange={(e) =>
                      updateConfig(
                        "performerIds",
                        e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                      )
                    }
                    placeholder="actriz-id-1, actriz-id-2"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="limit">Número de modelos</Label>
                <Select
                  value={String((config.limit as number) || 10)}
                  onValueChange={(value) => updateConfig("limit", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 modelos</SelectItem>
                    <SelectItem value="10">10 modelos</SelectItem>
                    <SelectItem value="15">15 modelos</SelectItem>
                    <SelectItem value="20">20 modelos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* CTA_BANNER Config */}
          {section.type === "CTA_BANNER" && (
            <Tabs value={ctaTab} onValueChange={setCtaTab} className="w-full">
              <TabsList className={`grid w-full ${config.bgSource === "dbVideo" ? "grid-cols-2" : "grid-cols-3"}`}>
                {config.bgSource !== "dbVideo" && (
                  <TabsTrigger value="contenido">Contenido</TabsTrigger>
                )}
                <TabsTrigger value="fondo">Fondo</TabsTrigger>
                <TabsTrigger value="estilo">Estilo</TabsTrigger>
              </TabsList>

              {/* Tab Contenido — solo cuando NO es vídeo de la web */}
              {config.bgSource !== "dbVideo" && (
                <TabsContent value="contenido" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="ctaKicker">Etiqueta superior / Kicker (opcional)</Label>
                    <Input
                      id="ctaKicker"
                      value={(config.kicker as string) || ""}
                      onChange={(e) => updateConfig("kicker", e.target.value)}
                      placeholder="Ej: NEW SCENE | EXCLUSIVE"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usa &quot;|&quot; para separar el rótulo destacado y la categoría (ej: NEW SCENE | HARDCORE).
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctaTitle">Título del banner</Label>
                    <Input
                      id="ctaTitle"
                      value={(config.title as string) || ""}
                      onChange={(e) => updateConfig("title", e.target.value)}
                      placeholder="BUKKAKE PARTIES"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={(config.description as string) || ""}
                      onChange={(e) => updateConfig("description", e.target.value)}
                      placeholder="Apúntate a los bukkakes más salvajes del país."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="buttonText">Texto del botón</Label>
                      <Input
                        id="buttonText"
                        value={(config.buttonText as string) || ""}
                        onChange={(e) => updateConfig("buttonText", e.target.value)}
                        placeholder="Ver Eventos"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buttonUrl">URL del botón</Label>
                      <Input
                        id="buttonUrl"
                        value={(config.buttonUrl as string) || ""}
                        onChange={(e) => updateConfig("buttonUrl", e.target.value)}
                        placeholder="/eventos"
                      />
                    </div>
                  </div>
                </TabsContent>
              )}

              {/* Tab Fondo */}
              <TabsContent value="fondo" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Fuente del fondo</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: "image", label: "Imagen" },
                      { value: "uploadedVideo", label: "Video subido" },
                      { value: "dbVideo", label: "Vídeo de la web" },
                    ] as const).map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={(config.bgSource as string) === option.value ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => {
                          updateConfig("bgSource", option.value)
                          if (option.value === "dbVideo" && ctaTab === "contenido") {
                            setCtaTab("fondo")
                          }
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Image background */}
                {(!config.bgSource || config.bgSource === "image") && (
                  <div className="space-y-2">
                    <Label>Imagen de fondo</Label>
                    <FileDropzone
                      value={(config.backgroundImage as string) || null}
                      onChange={(url) => updateConfig("backgroundImage", url || "")}
                      accept="image"
                      folder="cta"
                      placeholder="Arrastra una imagen de fondo aquí"
                    />
                  </div>
                )}

                {/* Uploaded video background */}
                {config.bgSource === "uploadedVideo" && (
                  <div className="space-y-2">
                    <Label>Video de fondo</Label>
                    <FileDropzone
                      value={(config.videoUrl as string) || null}
                      onChange={(url) => updateConfig("videoUrl", url || "")}
                      accept="video"
                      folder="cta"
                      placeholder="Arrastra un video aquí (autoplay, sin sonido)"
                    />
                  </div>
                )}

                {/* DB Video selector */}
                {config.bgSource === "dbVideo" && (
                  <div className="space-y-2">
                    <Label>Seleccionar vídeo</Label>
                    <VideoSelector
                      value={config.dbVideoId ? [config.dbVideoId as string] : []}
                      onChange={(ids) => {
                        if (ids.length === 0) {
                          updateMultipleConfig({
                            dbVideoId: null,
                            dbVideoSlug: null,
                            dbVideoTitle: null,
                            dbVideoThumbnail: null,
                            dbVideoMuxPlaybackId: null,
                          })
                          return
                        }
                        // Take only the last selected (single mode)
                        const selectedId = ids[ids.length - 1]
                        // Fetch video details
                        fetch(`/api/admin/videos/search?ids=${selectedId}`)
                          .then((res) => res.json())
                          .then((data) => {
                            const video = data.videos?.[0]
                            if (video) {
                              const firstCategory = video.categories?.[0]?.category?.name || ""
                              const performerNames = (video.performers || [])
                                .map((p: { performer?: { name?: string } }) => p.performer?.name)
                                .filter(Boolean)
                                .join(" & ")
                              updateMultipleConfig({
                                dbVideoId: video.id,
                                dbVideoSlug: video.slug,
                                dbVideoTitle: video.title,
                                dbVideoThumbnail: video.thumbnailUrl,
                                dbVideoMuxPlaybackId: video.muxPlaybackId,
                                dbVideoCategory: firstCategory || null,
                                kicker: firstCategory
                                  ? `NEW SCENE | ${firstCategory.toUpperCase()}`
                                  : "NEW SCENE",
                                title: performerNames || video.title,
                                description: performerNames ? video.title : "",
                                buttonText: "WATCH NOW",
                                buttonUrl: `/videos/${video.slug}`,
                              })
                            }
                          })
                      }}
                      placeholder="Buscar vídeo por título..."
                    />
                    {!!config.dbVideoId && !!config.dbVideoSlug && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">
                          {String(config.dbVideoTitle)}
                        </p>
                        {config.dbVideoMuxPlaybackId ? (
                          <div className="rounded-md overflow-hidden border">
                            <MuxVideoPlayer
                              videoId={config.dbVideoId as string}
                              videoSlug={config.dbVideoSlug as string}
                              playbackId={config.dbVideoMuxPlaybackId as string}
                              title={String(config.dbVideoTitle)}
                              thumbnailUrl={(config.dbVideoThumbnail as string) || undefined}
                              autoPlay
                              muted
                              loop
                            />
                          </div>
                        ) : config.dbVideoThumbnail ? (
                          <div className="relative w-full h-32 rounded-md overflow-hidden border">
                            <img
                              src={config.dbVideoThumbnail as string}
                              alt={String(config.dbVideoTitle)}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                    {/* Contenido editable cuando hay vídeo seleccionado */}
                    {!!config.dbVideoId && (
                      <div className="space-y-4 pt-3 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="ctaKickerDb">Etiqueta superior / Kicker</Label>
                          <Input
                            id="ctaKickerDb"
                            value={(config.kicker as string) || ""}
                            onChange={(e) => updateConfig("kicker", e.target.value)}
                            placeholder="NEW SCENE | CATEGORY"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ctaTitleDb">Título (Nombre de actriz / Titular)</Label>
                          <Input
                            id="ctaTitleDb"
                            value={(config.title as string) || ""}
                            onChange={(e) => updateConfig("title", e.target.value)}
                            placeholder="Título del banner"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="descriptionDb">Descripción (opcional)</Label>
                          <Textarea
                            id="descriptionDb"
                            value={(config.description as string) || ""}
                            onChange={(e) => updateConfig("description", e.target.value)}
                            placeholder="Texto adicional bajo el título..."
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="buttonTextDb">Texto del botón</Label>
                            <Input
                              id="buttonTextDb"
                              value={(config.buttonText as string) || ""}
                              onChange={(e) => updateConfig("buttonText", e.target.value)}
                              placeholder="Ver Vídeo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="buttonUrlDb">URL del botón</Label>
                            <Input
                              id="buttonUrlDb"
                              value={(config.buttonUrl as string) || ""}
                              onChange={(e) => updateConfig("buttonUrl", e.target.value)}
                              placeholder="/videos/slug"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Overlay controls */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="overlayEnabled">Overlay oscuro</Label>
                      <p className="text-xs text-muted-foreground">
                        Oscurecer el fondo para mejorar la legibilidad
                      </p>
                    </div>
                    <Switch
                      id="overlayEnabled"
                      checked={(config.overlayEnabled as boolean) ?? true}
                      onCheckedChange={(checked) => updateConfig("overlayEnabled", checked)}
                    />
                  </div>
                  {(config.overlayEnabled ?? true) && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="overlayOpacity">Intensidad del overlay ({((config.overlayOpacity as number) ?? 0.5).toFixed(2)})</Label>
                        <input
                          id="overlayOpacity"
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

                {/* Blur controls */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="blurEnabled">Desenfoque</Label>
                      <p className="text-xs text-muted-foreground">
                        Difuminar el fondo para destacar el contenido
                      </p>
                    </div>
                    <Switch
                      id="blurEnabled"
                      checked={(config.blurEnabled as boolean) ?? false}
                      onCheckedChange={(checked) => updateConfig("blurEnabled", checked)}
                    />
                  </div>
                  {!!config.blurEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="blurIntensity">Intensidad ({(config.blurIntensity as number) ?? 4}px)</Label>
                      <input
                        id="blurIntensity"
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={(config.blurIntensity as number) ?? 4}
                        onChange={(e) => updateConfig("blurIntensity", parseInt(e.target.value))}
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

              {/* Tab Estilo */}
              <TabsContent value="estilo" className="space-y-4 mt-4">
                {/* Banner height */}
                <div className="space-y-2">
                  <Label htmlFor="bannerHeight">Banner Height ({(config.height as number) || 486}px)</Label>
                  <input
                    id="bannerHeight"
                    type="range"
                    min="200"
                    max="900"
                    step="10"
                    value={(config.height as number) || 486}
                    onChange={(e) => updateConfig("height", parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>200px</span>
                    <span>900px</span>
                  </div>
                </div>

                {/* Content position */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Content Position</Label>
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
                        variant={(config.contentPosition as string || "center") === pos.value ? "secondary" : "outline"}
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
                  <Label className="text-sm font-medium">Title Typography</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="titleFontFamily" className="text-xs text-muted-foreground">Fuente</Label>
                      <Select
                        value={(config.titleFontFamily as string) || "Montserrat"}
                        onValueChange={(value) => updateConfig("titleFontFamily", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Montserrat">Montserrat</SelectItem>
                          <SelectItem value="Inter">Inter</SelectItem>
                          <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                          <SelectItem value="Oswald">Oswald</SelectItem>
                          <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="titleFontSize" className="text-xs text-muted-foreground">Tamaño (px)</Label>
                      <Input
                        id="titleFontSize"
                        type="number"
                        min={16}
                        max={72}
                        value={(config.titleFontSize as number) || 40}
                        onChange={(e) => updateConfig("titleFontSize", parseInt(e.target.value) || 40)}
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
          )}

          {/* COUNTDOWN / UPCOMING SCENE Config */}
          {section.type === "COUNTDOWN" && (
            <div className="space-y-4">
              {/* Mode selector */}
              <div className="space-y-2">
                <Label>Modo de funcionamiento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={countdownMode === "auto" ? "default" : "outline"}
                    onClick={() => updateConfig("mode", "auto")}
                    className="w-full"
                  >
                    Automático (Piloto Automático)
                  </Button>
                  <Button
                    type="button"
                    variant={countdownMode === "manual" ? "default" : "outline"}
                    onClick={() => updateConfig("mode", "manual")}
                    className="w-full"
                  >
                    Manual (Personalizado)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {countdownMode === "auto"
                    ? "Usa la fecha/hora de estreno (releaseDate) del vídeo seleccionado o busca automáticamente el próximo estreno y el último publicado."
                    : "Control manual completo: configura fecha/hora objetivo, textos, fondos y transición entre Estado A, Estado B y Estado C."}
                </p>
              </div>

              <Tabs value={countdownTab} onValueChange={setCountdownTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="contenido">
                    {countdownMode === "auto" ? "Vídeo / Auto" : "Estado A"}
                  </TabsTrigger>
                  <TabsTrigger value="estados">Estados B y C</TabsTrigger>
                  <TabsTrigger value="fondo">Fondo</TabsTrigger>
                  <TabsTrigger value="estilo">Estilo</TabsTrigger>
                </TabsList>

                {/* Tab 1: Auto Video Selection OR Manual State A */}
                <TabsContent value="contenido" className="space-y-4 mt-4">
                  {countdownMode === "auto" ? (
                    <>
                      <div className="space-y-2">
                        <Label>Vídeo destacado (opcional)</Label>
                        <VideoSelector
                          value={config.videoId ? [config.videoId as string] : []}
                          onChange={(ids) => {
                            if (ids.length === 0) {
                              updateMultipleConfig({
                                videoId: null,
                                videoTitle: null,
                                videoSlug: null,
                                videoThumbnail: null,
                                videoReleaseDate: null,
                                videoPerformers: null,
                                videoCategory: null,
                              })
                              return
                            }
                            const selectedId = ids[ids.length - 1]
                            fetch(`/api/admin/videos/search?ids=${selectedId}`)
                              .then((res) => res.json())
                              .then((data) => {
                                const video = data.videos?.[0]
                                if (video) {
                                  const performers = (video.performers || [])
                                    .map((p: { performer?: { name?: string } }) => p.performer?.name)
                                    .filter(Boolean)
                                    .join(" & ")
                                  const category = video.categories?.[0]?.category?.name || ""
                                  updateMultipleConfig({
                                    mode: "auto",
                                    videoId: video.id,
                                    videoTitle: video.title,
                                    videoSlug: video.slug,
                                    videoThumbnail: video.thumbnailUrl,
                                    videoReleaseDate: video.releaseDate || null,
                                    videoPerformers: performers || null,
                                    videoCategory: category || null,
                                  })
                                }
                              })
                          }}
                          placeholder="Buscar vídeo por título o slug (déjalo vacío para piloto automático total)..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Si no seleccionas ningún vídeo (o cuando pasen los días configurados tras su estreno), el banner buscará automáticamente el próximo vídeo programado o mostrará el último publicado como LATEST RELEASE.
                        </p>
                      </div>

                      {!!config.videoId && (
                        <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {(config.videoPerformers as string) || (config.videoTitle as string)}
                              </p>
                              {!!config.videoPerformers && !!config.videoTitle && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {String(config.videoTitle)}
                                </p>
                              )}
                            </div>
                            {!!config.videoCategory && (
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {String(config.videoCategory)}
                              </Badge>
                            )}
                          </div>
                          {!!config.videoReleaseDate && (
                            <p className="text-xs text-muted-foreground">
                              Estreno programado:{" "}
                              <span className="font-medium text-foreground">
                                {new Date(String(config.videoReleaseDate)).toLocaleString("es-ES", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t">
                        <Label htmlFor="newReleaseWindowDays">
                          Ventana de &quot;Recién Estrenado&quot; — Estado B (días)
                        </Label>
                        <Input
                          id="newReleaseWindowDays"
                          type="number"
                          min={1}
                          max={60}
                          value={(config.newReleaseWindowDays as number) ?? 4}
                          onChange={(e) =>
                            updateConfig(
                              "newReleaseWindowDays",
                              Math.max(1, parseInt(e.target.value) || 4)
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Durante cuántos días tras la hora de estreno se mostrará el vídeo como NEW SCENE con botón WATCH NOW antes de pasar al Estado C (Fallback).
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-md border p-3 bg-muted/20 text-xs text-muted-foreground">
                        <strong>Estado A (Cuenta Atrás):</strong> Visible mientras la fecha y hora objetivo estén en el futuro.
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="targetDate">Fecha y hora objetivo</Label>
                        <Input
                          id="targetDate"
                          type="datetime-local"
                          value={toDateTimeLocalInput(config.targetDate as string | undefined)}
                          onChange={(e) => updateConfig("targetDate", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="countdownKicker">Etiqueta superior / Kicker (Estado A)</Label>
                        <Input
                          id="countdownKicker"
                          value={(config.kicker as string) || ""}
                          onChange={(e) => updateConfig("kicker", e.target.value)}
                          placeholder="UPCOMING SCENE | EXCLUSIVE"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="countdownTitle">Título principal (Actriz / Evento)</Label>
                        <Input
                          id="countdownTitle"
                          value={(config.title as string) || ""}
                          onChange={(e) => updateConfig("title", e.target.value)}
                          placeholder="MARIA ROSSI"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
                        <Input
                          id="subtitle"
                          value={(config.subtitle as string) || ""}
                          onChange={(e) => updateConfig("subtitle", e.target.value)}
                          placeholder="Bukkake Party Barcelona"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="stateAButtonText">Botón Estado A (opcional)</Label>
                          <Input
                            id="stateAButtonText"
                            value={(config.stateAButtonText as string) || ""}
                            onChange={(e) => updateConfig("stateAButtonText", e.target.value)}
                            placeholder="Ej: VER DETALLES"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="stateAButtonUrl">URL botón Estado A</Label>
                          <Input
                            id="stateAButtonUrl"
                            value={(config.stateAButtonUrl as string) || ""}
                            onChange={(e) => updateConfig("stateAButtonUrl", e.target.value)}
                            placeholder="/videos"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Tab 2: States B & C */}
                <TabsContent value="estados" className="space-y-5 mt-4">
                  {countdownMode === "auto" ? (
                    <>
                      <div className="rounded-md border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
                        <p><strong>Estado A (Futuro):</strong> Cronómetro + tráiler desenfocado + botón Notify Me.</p>
                        <p><strong>Estado B (Recién estrenado):</strong> Kicker + actriz en grande + botón Watch Now durante {String((config.newReleaseWindowDays as number) ?? 4)} días.</p>
                        <p><strong>Estado C (Fallback):</strong> Busca próximo estreno programado o muestra el último vídeo publicado del catálogo.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="autoStateAKicker">Rótulo Estado A</Label>
                          <Input
                            id="autoStateAKicker"
                            value={(config.autoStateAKicker as string) || ""}
                            onChange={(e) => updateConfig("autoStateAKicker", e.target.value)}
                            placeholder="UPCOMING SCENE"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="autoStateBKicker">Rótulo Estado B</Label>
                          <Input
                            id="autoStateBKicker"
                            value={(config.autoStateBKicker as string) || ""}
                            onChange={(e) => updateConfig("autoStateBKicker", e.target.value)}
                            placeholder="NEW SCENE"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="autoStateCKicker">Rótulo Estado C</Label>
                          <Input
                            id="autoStateCKicker"
                            value={(config.autoStateCKicker as string) || ""}
                            onChange={(e) => updateConfig("autoStateCKicker", e.target.value)}
                            placeholder="LATEST RELEASE"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="autoNotifyButtonText">Botón Notify Me</Label>
                          <Input
                            id="autoNotifyButtonText"
                            value={(config.autoNotifyButtonText as string) || ""}
                            onChange={(e) => updateConfig("autoNotifyButtonText", e.target.value)}
                            placeholder="NOTIFY ME"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="autoNotifiedButtonText">Botón ya suscrito</Label>
                          <Input
                            id="autoNotifiedButtonText"
                            value={(config.autoNotifiedButtonText as string) || ""}
                            onChange={(e) => updateConfig("autoNotifiedButtonText", e.target.value)}
                            placeholder="NOTIFIED"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="autoWatchButtonText">Botón Watch Now</Label>
                          <Input
                            id="autoWatchButtonText"
                            value={(config.autoWatchButtonText as string) || ""}
                            onChange={(e) => updateConfig("autoWatchButtonText", e.target.value)}
                            placeholder="WATCH NOW"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Manual State B */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">
                            Estado B — Al llegar el reloj a 00:00:00
                          </Label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="stateBKicker">Etiqueta / Kicker Estado B</Label>
                            <Input
                              id="stateBKicker"
                              value={(config.stateBKicker as string) || ""}
                              onChange={(e) => updateConfig("stateBKicker", e.target.value)}
                              placeholder="NEW SCENE | OUT NOW"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="stateBDurationDays">Duración Estado B (días)</Label>
                            <Input
                              id="stateBDurationDays"
                              type="number"
                              min={0}
                              max={90}
                              value={(config.stateBDurationDays as number) ?? 4}
                              onChange={(e) =>
                                updateConfig(
                                  "stateBDurationDays",
                                  Math.max(0, parseInt(e.target.value) || 0)
                                )
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stateBTitle">Título Estado B (Nombre actriz / Titular)</Label>
                          <Input
                            id="stateBTitle"
                            value={(config.stateBTitle as string) || ""}
                            onChange={(e) => updateConfig("stateBTitle", e.target.value)}
                            placeholder="Si se deja vacío usa el título del Estado A"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="stateBSubtitle">Subtítulo Estado B (opcional)</Label>
                          <Input
                            id="stateBSubtitle"
                            value={(config.stateBSubtitle as string) || ""}
                            onChange={(e) => updateConfig("stateBSubtitle", e.target.value)}
                            placeholder="Ya disponible en 4K"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="stateBButtonText">Texto del botón</Label>
                            <Input
                              id="stateBButtonText"
                              value={(config.stateBButtonText as string) || ""}
                              onChange={(e) => updateConfig("stateBButtonText", e.target.value)}
                              placeholder="WATCH NOW"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="stateBButtonUrl">URL del botón</Label>
                            <Input
                              id="stateBButtonUrl"
                              value={(config.stateBButtonUrl as string) || ""}
                              onChange={(e) => updateConfig("stateBButtonUrl", e.target.value)}
                              placeholder="/videos/mi-escena"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Imagen de fondo Estado B (opcional, hereda Estado A si vacío)</Label>
                          <FileDropzone
                            value={(config.stateBBackgroundImage as string) || null}
                            onChange={(url) => updateConfig("stateBBackgroundImage", url || "")}
                            accept="image"
                            folder="countdown"
                            placeholder="Sobrescribir imagen en Estado B (opcional)"
                          />
                        </div>
                      </div>

                      {/* Manual State C Dropdown */}
                      <div className="space-y-3 pt-4 border-t">
                        <div className="space-y-2">
                          <Label htmlFor="manualStateCAction" className="text-sm font-semibold">
                            Estado C — Qué hacer al terminar los días del Estado B
                          </Label>
                          <Select
                            value={(config.manualStateCAction as string) || "auto"}
                            onValueChange={(value) => updateConfig("manualStateCAction", value)}
                          >
                            <SelectTrigger id="manualStateCAction">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">
                                Pasar a modo automático (próximo estreno / último vídeo)
                              </SelectItem>
                              <SelectItem value="keep_b">
                                Mantener Estado B indefinidamente
                              </SelectItem>
                              <SelectItem value="custom">
                                Mostrar nueva secuencia personalizada
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(config.manualStateCAction as string) === "custom" && (
                          <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                            <div className="space-y-2">
                              <Label htmlFor="stateCKicker">Etiqueta / Kicker Estado C</Label>
                              <Input
                                id="stateCKicker"
                                value={(config.stateCKicker as string) || ""}
                                onChange={(e) => updateConfig("stateCKicker", e.target.value)}
                                placeholder="LATEST RELEASE | EXCLUSIVE"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="stateCTitle">Título Estado C</Label>
                              <Input
                                id="stateCTitle"
                                value={(config.stateCTitle as string) || ""}
                                onChange={(e) => updateConfig("stateCTitle", e.target.value)}
                                placeholder="Título de la siguiente secuencia"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="stateCSubtitle">Subtítulo Estado C (opcional)</Label>
                              <Input
                                id="stateCSubtitle"
                                value={(config.stateCSubtitle as string) || ""}
                                onChange={(e) => updateConfig("stateCSubtitle", e.target.value)}
                                placeholder="Descripción corta"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="stateCButtonText">Texto del botón</Label>
                                <Input
                                  id="stateCButtonText"
                                  value={(config.stateCButtonText as string) || ""}
                                  onChange={(e) => updateConfig("stateCButtonText", e.target.value)}
                                  placeholder="WATCH NOW"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="stateCButtonUrl">URL del botón</Label>
                                <Input
                                  id="stateCButtonUrl"
                                  value={(config.stateCButtonUrl as string) || ""}
                                  onChange={(e) => updateConfig("stateCButtonUrl", e.target.value)}
                                  placeholder="/videos"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="stateCTargetDate">
                                Nueva fecha/hora de cuenta atrás (opcional)
                              </Label>
                              <Input
                                id="stateCTargetDate"
                                type="datetime-local"
                                value={toDateTimeLocalInput(
                                  config.stateCTargetDate as string | undefined
                                )}
                                onChange={(e) => updateConfig("stateCTargetDate", e.target.value)}
                              />
                              <p className="text-xs text-muted-foreground">
                                Si configuras una fecha futura, el Estado C arrancará una nueva cuenta atrás encadenada.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Imagen de fondo Estado C (opcional)</Label>
                              <FileDropzone
                                value={(config.stateCBackgroundImage as string) || null}
                                onChange={(url) =>
                                  updateConfig("stateCBackgroundImage", url || "")
                                }
                                accept="image"
                                folder="countdown"
                                placeholder="Imagen personalizada para Estado C"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Vídeo de fondo Estado C (opcional)</Label>
                              <FileDropzone
                                value={(config.stateCVideoUrl as string) || null}
                                onChange={(url) => updateConfig("stateCVideoUrl", url || "")}
                                accept="video"
                                folder="countdown"
                                placeholder="Vídeo personalizado para Estado C"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* Tab 3: Background, Blur & Overlay */}
                <TabsContent value="fondo" className="space-y-4 mt-4">
                  {countdownMode === "auto" && (
                    <div className="rounded-md border p-3 bg-muted/20 text-xs text-muted-foreground">
                      En modo automático el banner usa el tráiler/preview y miniatura del vídeo de la BD. Si subes una imagen o vídeo aquí, sobrescribirá el fondo automático.
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      Imagen de fondo {countdownMode === "auto" ? "(sobrescritura opcional)" : "(opcional)"}
                    </Label>
                    <FileDropzone
                      value={(config.backgroundImage as string) || null}
                      onChange={(url) => updateConfig("backgroundImage", url || "")}
                      accept="image"
                      folder="countdown"
                      placeholder="Arrastra una imagen de fondo aquí"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Video de fondo {countdownMode === "auto" ? "(sobrescritura opcional)" : "(opcional)"}
                    </Label>
                    <FileDropzone
                      value={(config.videoUrl as string) || null}
                      onChange={(url) => updateConfig("videoUrl", url || "")}
                      accept="video"
                      folder="countdown"
                      placeholder="Arrastra un video aquí para usarlo como fondo (autoplay, sin sonido)"
                    />
                  </div>

                  {/* Overlay color & opacity controls */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="countdownOverlayEnabled">Color superpuesto (Overlay)</Label>
                        <p className="text-xs text-muted-foreground">
                          Graduar color y opacidad encima del vídeo o fotografía
                        </p>
                      </div>
                      <Switch
                        id="countdownOverlayEnabled"
                        checked={(config.overlayEnabled as boolean) ?? true}
                        onCheckedChange={(checked) => updateConfig("overlayEnabled", checked)}
                      />
                    </div>
                    {(config.overlayEnabled ?? true) && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="countdownOverlayOpacity">
                            Opacidad ({((config.overlayOpacity as number) ?? 0.58).toFixed(2)})
                          </Label>
                          <input
                            id="countdownOverlayOpacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={(config.overlayOpacity as number) ?? 0.58}
                            onChange={(e) =>
                              updateConfig("overlayOpacity", parseFloat(e.target.value))
                            }
                            className="w-full accent-primary"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0 (transparente)</span>
                            <span>1 (opaco total)</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Color del overlay</Label>
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

                  {/* Blur controls */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="countdownBlurEnabled">Desenfoque cinemático (Blur)</Label>
                        <p className="text-xs text-muted-foreground">
                          Difuminar el tráiler o imagen de fondo para crear atmósfera
                        </p>
                      </div>
                      <Switch
                        id="countdownBlurEnabled"
                        checked={
                          config.blurEnabled !== undefined
                            ? Boolean(config.blurEnabled)
                            : countdownMode === "auto"
                        }
                        onCheckedChange={(checked) => updateConfig("blurEnabled", checked)}
                      />
                    </div>
                    {(config.blurEnabled !== undefined
                      ? Boolean(config.blurEnabled)
                      : countdownMode === "auto") && (
                      <div className="space-y-2">
                        <Label htmlFor="countdownBlurIntensity">
                          Intensidad del desenfoque ({(config.blurIntensity as number) ?? 6}px)
                        </Label>
                        <input
                          id="countdownBlurIntensity"
                          type="range"
                          min="1"
                          max="20"
                          step="1"
                          value={(config.blurIntensity as number) ?? 6}
                          onChange={(e) =>
                            updateConfig("blurIntensity", parseInt(e.target.value))
                          }
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

                {/* Tab 4: Height, Position, Typography & Button Colors */}
                <TabsContent value="estilo" className="space-y-4 mt-4">
                  {/* Height */}
                  <div className="space-y-2">
                    <Label>Altura del banner ({(config.height as number) || 540}px)</Label>
                    <input
                      type="range"
                      min="260"
                      max="900"
                      step="10"
                      value={(config.height as number) || 540}
                      onChange={(e) => updateConfig("height", parseInt(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>260px</span>
                      <span>900px</span>
                    </div>
                  </div>

                  {/* Content Position */}
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
                          variant={
                            ((config.contentPosition as string) || "center") === pos.value
                              ? "secondary"
                              : "outline"
                          }
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
                    <Label className="text-sm font-medium">Tipografía del titular</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="countdownTitleFontFamily" className="text-xs text-muted-foreground">
                          Fuente
                        </Label>
                        <Select
                          value={(config.titleFontFamily as string) || "Montserrat"}
                          onValueChange={(value) => updateConfig("titleFontFamily", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Montserrat">Montserrat</SelectItem>
                            <SelectItem value="Inter">Inter</SelectItem>
                            <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                            <SelectItem value="Oswald">Oswald</SelectItem>
                            <SelectItem value="Bebas Neue">Bebas Neue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="countdownTitleFontSize" className="text-xs text-muted-foreground">
                          Tamaño máx. (px)
                        </Label>
                        <Input
                          id="countdownTitleFontSize"
                          type="number"
                          min={24}
                          max={96}
                          value={(config.titleFontSize as number) || 72}
                          onChange={(e) =>
                            updateConfig("titleFontSize", parseInt(e.target.value) || 72)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Button colors */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-sm font-medium">Colores del botón CTA</Label>
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
            </div>
          )}

          {/* CATEGORY_FEATURED Config */}
          {section.type === "CATEGORY_FEATURED" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="categoryId">ID de categoría</Label>
                <Input
                  id="categoryId"
                  value={(config.categoryId as string) || ""}
                  onChange={(e) => updateConfig("categoryId", e.target.value)}
                  placeholder="categoria-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="featuredLimit">Número de videos</Label>
                <Select
                  value={String((config.limit as number) || 6)}
                  onValueChange={(value) => updateConfig("limit", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 videos</SelectItem>
                    <SelectItem value="6">6 videos</SelectItem>
                    <SelectItem value="9">9 videos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="featuredDisplayMode">Visualización</Label>
                <Select
                  value={(config.displayMode as string) || "grid"}
                  onValueChange={(value) => updateConfig("displayMode", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Cuadrícula (grid fijo)</SelectItem>
                    <SelectItem value="carousel">Carrusel (scroll horizontal)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
