"use client"

import * as React from "react"
import { IconLoader2, IconLock, IconEye } from "@tabler/icons-react"
import { CalendarClock, Download, Lock, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileDropzone } from "@/components/ui/file-dropzone"
import { toast } from "sonner"
import {
  DEFAULT_VIDEO_DOWNLOAD_POLICY,
  DOWNLOAD_DELAY_PRESETS,
  MAX_DOWNLOAD_DELAY_BY_UNIT,
  addDelayToDate,
  formatDownloadDelayLabel,
  formatDownloadUnlockDate,
  sanitizeVideoDownloadPolicy,
  type DownloadDelayUnit,
  type VideoDownloadPolicy,
} from "@/lib/video-download-policy"

interface LockScreenData {
  title: string
  description: string
  buttonText: string
  buttonUrl: string
  backgroundImage: string | null
  overlaySize: "compact" | "normal" | "large"
  showTierBadge: boolean
  // Title styling
  titleFontSize: string
  titleFontWeight: string
  // Description styling
  descriptionFontSize: string
  descriptionFontWeight: string
  // Button styling
  buttonBgColor: string
  buttonHoverBgColor: string
  buttonTextColor: string
  buttonBorderRadius: string
  buttonPaddingX: string
  buttonPaddingY: string
  // Tier badge styling
  tierBadgeTextColor: string
  tierBadgeAccentColor: string
  // Lock reason messages
  messageLockedByTier: string
  messageLockedByExclusive: string
  messageLockedByEarlyAccess: string
  messageLockedByNoSession: string
}

const DEFAULT_DATA: LockScreenData = {
  title: "Acceso Denegado",
  description: "Este contenido requiere una suscripción",
  buttonText: "Ver Planes",
  buttonUrl: "/suscripciones",
  backgroundImage: null,
  overlaySize: "normal",
  showTierBadge: true,
  titleFontSize: "text-xl",
  titleFontWeight: "font-bold",
  descriptionFontSize: "text-base",
  descriptionFontWeight: "font-normal",
  buttonBgColor: "#FA4860",
  buttonHoverBgColor: "#e03d53",
  buttonTextColor: "#FFFFFF",
  buttonBorderRadius: "rounded-none",
  buttonPaddingX: "px-6",
  buttonPaddingY: "py-3",
  tierBadgeTextColor: "rgba(255,255,255,0.8)",
  tierBadgeAccentColor: "var(--brand-color)",
  messageLockedByTier: "Este contenido requiere una suscripción superior",
  messageLockedByExclusive: "Contenido exclusivo para suscriptores Diamond",
  messageLockedByEarlyAccess: "Acceso anticipado para suscriptores Platinum+",
  messageLockedByNoSession: "Inicia sesión para ver este contenido",
}

const FONT_SIZE_OPTIONS = [
  { value: "text-xs", label: "Extra pequeño (xs)" },
  { value: "text-sm", label: "Pequeño (sm)" },
  { value: "text-base", label: "Normal (base)" },
  { value: "text-lg", label: "Grande (lg)" },
  { value: "text-xl", label: "Extra grande (xl)" },
  { value: "text-2xl", label: "2XL" },
  { value: "text-3xl", label: "3XL" },
  { value: "text-4xl", label: "4XL" },
]

const FONT_WEIGHT_OPTIONS = [
  { value: "font-light", label: "Light (300)" },
  { value: "font-normal", label: "Normal (400)" },
  { value: "font-medium", label: "Medium (500)" },
  { value: "font-semibold", label: "Semibold (600)" },
  { value: "font-bold", label: "Bold (700)" },
  { value: "font-extrabold", label: "Extra Bold (800)" },
]

const BORDER_RADIUS_OPTIONS = [
  { value: "rounded-none", label: "Sin redondeo" },
  { value: "rounded-sm", label: "Pequeño" },
  { value: "rounded", label: "Normal" },
  { value: "rounded-md", label: "Medio" },
  { value: "rounded-lg", label: "Grande" },
  { value: "rounded-xl", label: "Extra grande" },
  { value: "rounded-2xl", label: "2XL" },
  { value: "rounded-full", label: "Completo (pill)" },
]

const PADDING_X_OPTIONS = [
  { value: "px-2", label: "2 (0.5rem)" },
  { value: "px-3", label: "3 (0.75rem)" },
  { value: "px-4", label: "4 (1rem)" },
  { value: "px-5", label: "5 (1.25rem)" },
  { value: "px-6", label: "6 (1.5rem)" },
  { value: "px-8", label: "8 (2rem)" },
  { value: "px-10", label: "10 (2.5rem)" },
  { value: "px-12", label: "12 (3rem)" },
]

const PADDING_Y_OPTIONS = [
  { value: "py-1", label: "1 (0.25rem)" },
  { value: "py-2", label: "2 (0.5rem)" },
  { value: "py-3", label: "3 (0.75rem)" },
  { value: "py-4", label: "4 (1rem)" },
  { value: "py-5", label: "5 (1.25rem)" },
  { value: "py-6", label: "6 (1.5rem)" },
]

export function VideoAccessSettings() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [data, setData] = React.useState<LockScreenData>(DEFAULT_DATA)
  const [downloadPolicy, setDownloadPolicy] = React.useState<VideoDownloadPolicy>({
    ...DEFAULT_VIDEO_DOWNLOAD_POLICY,
  })
  const [isHovering, setIsHovering] = React.useState(false)

  React.useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings/video-access")
      if (response.ok) {
        const result = await response.json()
        setData({ ...DEFAULT_DATA, ...result.lockScreen })
        if (result.downloadPolicy) {
          setDownloadPolicy(sanitizeVideoDownloadPolicy(result.downloadPolicy))
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const sanitizedPolicy = sanitizeVideoDownloadPolicy(downloadPolicy)
      const response = await fetch("/api/admin/settings/video-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockScreen: data,
          downloadPolicy: sanitizedPolicy,
        }),
      })

      if (!response.ok) {
        throw new Error("Error al guardar")
      }

      const result = await response.json()
      if (result.downloadPolicy) {
        setDownloadPolicy(sanitizeVideoDownloadPolicy(result.downloadPolicy))
      }
      toast.success("Configuración guardada correctamente")
    } catch (error) {
      toast.error("Error al guardar la configuración")
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = <K extends keyof LockScreenData>(
    field: K,
    value: LockScreenData[K]
  ) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const exampleUnlockDate = React.useMemo(() => {
    if (!downloadPolicy.enabled || downloadPolicy.delayValue <= 0) return null
    const future = addDelayToDate(
      new Date(),
      downloadPolicy.delayValue,
      downloadPolicy.delayUnit
    )
    return formatDownloadUnlockDate(future, "es")
  }, [downloadPolicy])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Programación de Descargas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-primary" />
            Programación de Descargas
          </CardTitle>
          <CardDescription>
            Define cuánto tiempo debe pasar desde la fecha de publicación de un vídeo antes de
            que los suscriptores con permiso de descarga puedan descargarlo. También puedes
            personalizar la fecha de descarga en cada vídeo individualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="downloadDelayEnabled" className="text-sm font-medium">
                Bloquear descargas en vídeos recién publicados
              </Label>
              <p className="text-xs text-muted-foreground">
                Cuando está activo, nadie podrá descargar un vídeo hasta que transcurra el
                periodo configurado desde su fecha de estreno.
              </p>
            </div>
            <Switch
              id="downloadDelayEnabled"
              checked={downloadPolicy.enabled}
              onCheckedChange={(checked) =>
                setDownloadPolicy((prev) => ({
                  ...prev,
                  enabled: checked,
                  delayValue: checked && prev.delayValue <= 0 ? 3 : prev.delayValue,
                  delayUnit: checked && prev.delayValue <= 0 ? "months" : prev.delayUnit,
                }))
              }
            />
          </div>

          {/* Presets rápidos */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Periodos predefinidos
            </Label>
            <div className="flex flex-wrap gap-2">
              {DOWNLOAD_DELAY_PRESETS.map((preset) => {
                const isSelected =
                  preset.enabled === downloadPolicy.enabled &&
                  (!preset.enabled ||
                    (preset.delayValue === downloadPolicy.delayValue &&
                      preset.delayUnit === downloadPolicy.delayUnit))
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() =>
                      setDownloadPolicy({
                        enabled: preset.enabled,
                        delayValue: preset.delayValue,
                        delayUnit: preset.delayUnit,
                      })
                    }
                  >
                    {preset.label}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Periodo personalizado */}
          {downloadPolicy.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downloadDelayValue">Tiempo de espera</Label>
                <Input
                  id="downloadDelayValue"
                  type="number"
                  min={1}
                  max={MAX_DOWNLOAD_DELAY_BY_UNIT[downloadPolicy.delayUnit]}
                  value={downloadPolicy.delayValue}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    const max = MAX_DOWNLOAD_DELAY_BY_UNIT[downloadPolicy.delayUnit]
                    setDownloadPolicy((prev) => ({
                      ...prev,
                      delayValue: Number.isFinite(raw)
                        ? Math.min(max, Math.max(0, Math.round(raw)))
                        : 0,
                    }))
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="downloadDelayUnit">Unidad de tiempo</Label>
                <Select
                  value={downloadPolicy.delayUnit}
                  onValueChange={(value) => {
                    const unit = value as DownloadDelayUnit
                    const max = MAX_DOWNLOAD_DELAY_BY_UNIT[unit]
                    setDownloadPolicy((prev) => ({
                      ...prev,
                      delayUnit: unit,
                      delayValue: Math.min(max, prev.delayValue),
                    }))
                  }}
                >
                  <SelectTrigger id="downloadDelayUnit">
                    <SelectValue placeholder="Selecciona unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Días</SelectItem>
                    <SelectItem value="weeks">Semanas</SelectItem>
                    <SelectItem value="months">Meses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Resumen y ejemplo en vivo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-md border bg-muted/40 px-4 py-3">
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 text-foreground font-medium">
                {downloadPolicy.enabled && downloadPolicy.delayValue > 0 ? (
                  <>
                    <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                    <span>
                      Regla activa: descargas bloqueadas durante{" "}
                      <strong>{formatDownloadDelayLabel(downloadPolicy, "es")}</strong> desde la
                      publicación
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="size-4 text-amber-500 shrink-0" />
                    <span>
                      Regla activa: los vídeos son descargables inmediatamente tras publicarse
                    </span>
                  </>
                )}
              </p>
              {exampleUnlockDate && (
                <p>
                  Ejemplo: un vídeo publicado hoy se podrá descargar a partir del{" "}
                  <strong className="text-foreground">{exampleUnlockDate}</strong>.
                </p>
              )}
            </div>

            <Button onClick={handleSave} disabled={isSaving} size="sm" className="shrink-0">
              {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
              Guardar Regla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenido del Overlay */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconLock className="size-5" />
            Pantalla de Acceso Denegado
          </CardTitle>
          <CardDescription>
            Configura el mensaje y diseño que se muestra cuando un usuario no tiene
            acceso a un video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Acceso Denegado"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={data.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Este contenido requiere una suscripción"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              El tier requerido se añade automáticamente si "Mostrar badge de tier" está activo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buttonText">Texto del botón</Label>
              <Input
                id="buttonText"
                value={data.buttonText}
                onChange={(e) => updateField("buttonText", e.target.value)}
                placeholder="Ver Planes"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonUrl">URL del botón</Label>
              <Input
                id="buttonUrl"
                value={data.buttonUrl}
                onChange={(e) => updateField("buttonUrl", e.target.value)}
                placeholder="/suscripciones"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensajes del aviso */}
      <Card>
        <CardHeader>
          <CardTitle>Mensajes del aviso según el motivo</CardTitle>
          <CardDescription>
            Texto que se muestra debajo del título según por qué está bloqueado el video.
            Sustituye al campo &quot;Descripción&quot; genérico cuando aplica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="messageLockedByNoSession">Sin sesión iniciada</Label>
            <Textarea
              id="messageLockedByNoSession"
              value={data.messageLockedByNoSession}
              onChange={(e) => updateField("messageLockedByNoSession", e.target.value)}
              placeholder="Inicia sesión para ver este contenido"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Usuario no registrado intentando acceder a un video con tier mínimo.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageLockedByTier">Suscripción insuficiente</Label>
            <Textarea
              id="messageLockedByTier"
              value={data.messageLockedByTier}
              onChange={(e) => updateField("messageLockedByTier", e.target.value)}
              placeholder="Este contenido requiere una suscripción superior"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Usuario registrado pero con nivel de suscripción por debajo del mínimo del video.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageLockedByExclusive">Contenido exclusivo Diamond</Label>
            <Textarea
              id="messageLockedByExclusive"
              value={data.messageLockedByExclusive}
              onChange={(e) => updateField("messageLockedByExclusive", e.target.value)}
              placeholder="Contenido exclusivo para suscriptores Diamond"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Video marcado como Diamond exclusive y el plan del usuario no tiene acceso.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messageLockedByEarlyAccess">Acceso anticipado Edición Limitada</Label>
            <Textarea
              id="messageLockedByEarlyAccess"
              value={data.messageLockedByEarlyAccess}
              onChange={(e) => updateField("messageLockedByEarlyAccess", e.target.value)}
              placeholder="Acceso anticipado para suscriptores Platinum+"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Video con limitedAccessUntil aún vigente y el plan no tiene canAccessLimitedEdition.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Diseño del Título */}
      <Card>
        <CardHeader>
          <CardTitle>Diseño del Título</CardTitle>
          <CardDescription>
            Personaliza el tamaño y grosor del título
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tamaño de fuente</Label>
              <Select
                value={data.titleFontSize}
                onValueChange={(value) => updateField("titleFontSize", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grosor de fuente</Label>
              <Select
                value={data.titleFontWeight}
                onValueChange={(value) => updateField("titleFontWeight", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grosor" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_WEIGHT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diseño de la Descripción */}
      <Card>
        <CardHeader>
          <CardTitle>Diseño de la Descripción</CardTitle>
          <CardDescription>
            Personaliza el tamaño y grosor de la descripción
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tamaño de fuente</Label>
              <Select
                value={data.descriptionFontSize}
                onValueChange={(value) => updateField("descriptionFontSize", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grosor de fuente</Label>
              <Select
                value={data.descriptionFontWeight}
                onValueChange={(value) => updateField("descriptionFontWeight", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un grosor" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_WEIGHT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diseño del Botón */}
      <Card>
        <CardHeader>
          <CardTitle>Diseño del Botón</CardTitle>
          <CardDescription>
            Personaliza los colores, bordes y tamaño del botón
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Colores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buttonBgColor">Color de fondo</Label>
              <div className="flex gap-2">
                <Input
                  id="buttonBgColor"
                  type="color"
                  value={data.buttonBgColor}
                  onChange={(e) => updateField("buttonBgColor", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={data.buttonBgColor}
                  onChange={(e) => updateField("buttonBgColor", e.target.value)}
                  placeholder="#FA4860"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonHoverBgColor">Color hover</Label>
              <div className="flex gap-2">
                <Input
                  id="buttonHoverBgColor"
                  type="color"
                  value={data.buttonHoverBgColor}
                  onChange={(e) => updateField("buttonHoverBgColor", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={data.buttonHoverBgColor}
                  onChange={(e) => updateField("buttonHoverBgColor", e.target.value)}
                  placeholder="#e03d53"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonTextColor">Color del texto</Label>
              <div className="flex gap-2">
                <Input
                  id="buttonTextColor"
                  type="color"
                  value={data.buttonTextColor}
                  onChange={(e) => updateField("buttonTextColor", e.target.value)}
                  className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={data.buttonTextColor}
                  onChange={(e) => updateField("buttonTextColor", e.target.value)}
                  placeholder="#FFFFFF"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Bordes y Padding */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bordes redondeados</Label>
              <Select
                value={data.buttonBorderRadius}
                onValueChange={(value) => updateField("buttonBorderRadius", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un estilo" />
                </SelectTrigger>
                <SelectContent>
                  {BORDER_RADIUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Padding horizontal</Label>
              <Select
                value={data.buttonPaddingX}
                onValueChange={(value) => updateField("buttonPaddingX", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona padding" />
                </SelectTrigger>
                <SelectContent>
                  {PADDING_X_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Padding vertical</Label>
              <Select
                value={data.buttonPaddingY}
                onValueChange={(value) => updateField("buttonPaddingY", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona padding" />
                </SelectTrigger>
                <SelectContent>
                  {PADDING_Y_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diseño General */}
      <Card>
        <CardHeader>
          <CardTitle>Diseño General</CardTitle>
          <CardDescription>
            Personaliza la apariencia general del overlay
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="overlaySize">Tamaño del overlay</Label>
            <Select
              value={data.overlaySize}
              onValueChange={(value) =>
                updateField("overlaySize", value as LockScreenData["overlaySize"])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tamaño" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compacto</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="large">Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mostrar badge de tier</Label>
              <p className="text-sm text-muted-foreground">
                Muestra "Requiere: Diamond" o el tier necesario
              </p>
            </div>
            <Switch
              checked={data.showTierBadge}
              onCheckedChange={(checked) => updateField("showTierBadge", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label>Imagen de fondo (opcional)</Label>
            <FileDropzone
              value={data.backgroundImage}
              onChange={(url) => updateField("backgroundImage", url)}
              accept="image"
              folder="settings"
              placeholder="Arrastra una imagen para el fondo del overlay"
            />
            <p className="text-xs text-muted-foreground">
              Si no se establece, se usará el thumbnail del video con opacidad reducida
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Vista previa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconEye className="size-5" />
            Vista Previa
          </CardTitle>
          <CardDescription>
            Así se verá la pantalla de acceso denegado (pasa el ratón sobre el botón para ver el hover)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {/* Background */}
            {data.backgroundImage ? (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{ backgroundImage: `url(${data.backgroundImage})` }}
              />
            ) : (
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30"
                style={{ backgroundImage: "url(/woman-street-fashion-blurred.jpg)" }}
              />
            )}

            {/* Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#FA4860]/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-[#FA4860]" />
              </div>
              <div className="max-w-md space-y-4">
                <h3
                  className={`text-white ${data.titleFontSize} ${data.titleFontWeight}`}
                >
                  {data.title}
                </h3>
                <p className={`text-white/80 ${data.descriptionFontSize} ${data.descriptionFontWeight}`}>
                  {data.description}
                </p>
                {data.showTierBadge && (
                  <p className="text-sm" style={{ color: data.tierBadgeTextColor }}>
                    Requiere suscripción{" "}
                    <span className="font-semibold" style={{ color: data.tierBadgeAccentColor }}>Diamond</span> o
                    superior
                  </p>
                )}
                <button
                  className={`mt-4 font-semibold transition-colors cursor-pointer ${data.buttonPaddingX} ${data.buttonPaddingY} ${data.buttonBorderRadius}`}
                  style={{
                    backgroundColor: isHovering ? data.buttonHoverBgColor : data.buttonBgColor,
                    color: data.buttonTextColor,
                  }}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  {data.buttonText}
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón Guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <IconLoader2 className="mr-2 size-4 animate-spin" />}
          Guardar Cambios
        </Button>
      </div>
    </div>
  )
}
