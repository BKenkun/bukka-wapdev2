"use client"

import * as React from "react"
import { Clock, ShieldCheck, Loader2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { useSessionTimeout } from "@/components/auth/session-timeout-provider"
import {
  SESSION_TIMEOUT_PRESETS,
  formatTimeoutDuration,
} from "@/lib/session-timeout"

interface SessionTimeoutSettingsCardProps {
  compact?: boolean
}

export function SessionTimeoutSettingsCard({
  compact = false,
}: SessionTimeoutSettingsCardProps) {
  const {
    sessionTimeoutMinutes,
    isPolicyLoaded,
    updateSessionTimeoutMinutes,
  } = useSessionTimeout()
  const [isSaving, setIsSaving] = React.useState(false)

  const hasCurrentPreset = SESSION_TIMEOUT_PRESETS.some(
    (p) => p.minutes === sessionTimeoutMinutes
  )

  const handleChange = async (value: string) => {
    const minutes = Number(value)
    if (!Number.isFinite(minutes) || minutes === sessionTimeoutMinutes) return

    setIsSaving(true)
    try {
      const saved = await updateSessionTimeoutMinutes(minutes)
      toast.success(
        `Cierre por inactividad actualizado a ${formatTimeoutDuration(saved, "es")}`
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al actualizar el tiempo de inactividad"
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className={compact ? "pb-3" : undefined}>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-primary" />
          Cierre de sesión por inactividad
        </CardTitle>
        <CardDescription>
          Aplica automáticamente a todos los usuarios conectados sin importar su rol
          (usuarios registrados, suscriptores y administradores). Se muestra un aviso
          en pantalla 60 segundos antes del cierre automático.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="session-timeout-select" className="text-sm font-medium">
              Tiempo máximo sin actividad
            </Label>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              <span>
                Política activa:{" "}
                <strong className="text-foreground">
                  {formatTimeoutDuration(sessionTimeoutMinutes, "es")}
                </strong>{" "}
                (sincronizado entre pestañas y en segundo plano)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSaving && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            <Select
              value={String(sessionTimeoutMinutes)}
              onValueChange={handleChange}
              disabled={isSaving || !isPolicyLoaded}
            >
              <SelectTrigger
                id="session-timeout-select"
                className="w-full sm:w-[240px]"
              >
                <SelectValue placeholder="Selecciona un tiempo" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TIMEOUT_PRESETS.map((preset) => (
                  <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                    {preset.label}
                  </SelectItem>
                ))}
                {!hasCurrentPreset && (
                  <SelectItem value={String(sessionTimeoutMinutes)}>
                    {formatTimeoutDuration(sessionTimeoutMinutes, "es")} (Personalizado)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
