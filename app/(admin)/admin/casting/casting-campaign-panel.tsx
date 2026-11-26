"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Clock,
  Loader2,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  DEFAULT_CASTING_SETTINGS,
  formatCastingDate,
  formatCastingDateRange,
  type CastingNotifyAudience,
  type CastingSettings,
} from "@/lib/casting-dates"

interface AudienceStats {
  applicants_only: number
  all_subscribers_and_applicants: number
  users_and_subscribers: number
}

interface RecentEmailLog {
  id: string
  to: string
  subject: string
  template: string
  status: string
  error: string | null
  createdAt: string
}

export function CastingCampaignPanel() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [sendingAction, setSendingAction] = React.useState<string | null>(null)
  const [confirmEvent, setConfirmEvent] = React.useState<"opened" | "closed" | null>(null)

  const [settings, setSettings] = React.useState<CastingSettings>(DEFAULT_CASTING_SETTINGS)
  const [audienceStats, setAudienceStats] = React.useState<AudienceStats>({
    applicants_only: 0,
    all_subscribers_and_applicants: 0,
    users_and_subscribers: 0,
  })
  const [recentLogs, setRecentLogs] = React.useState<RecentEmailLog[]>([])
  const [adminEmail, setAdminEmail] = React.useState("")
  const [customNote, setCustomNote] = React.useState("")

  const loadData = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/casting/settings")
      if (!res.ok) throw new Error("Failed to load casting settings")
      const data = await res.json()
      if (data.settings) setSettings(data.settings)
      if (data.audienceStats) setAudienceStats(data.audienceStats)
      if (Array.isArray(data.recentLogs)) setRecentLogs(data.recentLogs)
      if (data.adminEmail) setAdminEmail(data.adminEmail)
    } catch (error) {
      console.error("Error loading casting campaign settings:", error)
      toast.error("No se pudo cargar la configuración de casting")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const updateField = <K extends keyof CastingSettings>(key: K, value: CastingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/casting/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: settings.campaignName,
          campaignStatus: settings.campaignStatus,
          closedMessage: settings.closedMessage,
          showImportantDates: settings.showImportantDates,
          applicationsOpenDate: settings.applicationsOpenDate,
          applicationsCloseDate: settings.applicationsCloseDate,
          auditionsStartDate: settings.auditionsStartDate,
          auditionsEndDate: settings.auditionsEndDate,
          resultsDate: settings.resultsDate,
          autoNotifyOnOpen: settings.autoNotifyOnOpen,
          autoNotifyOnClose: settings.autoNotifyOnClose,
          notifyAudience: settings.notifyAudience,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error al guardar")
      }

      if (data.settings) {
        setSettings(data.settings)
      }

      if (data.dispatchResult) {
        const dr = data.dispatchResult
        toast.success(
          `Configuración guardada y notificación enviada (${dr.sent} enviados, ${dr.failed} fallidos)`
        )
      } else {
        toast.success("Configuración de casting guardada correctamente")
      }

      await loadData()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDispatch = async (event: "opened" | "closed", isTest: boolean) => {
    if (isTest && !adminEmail.trim()) {
      toast.error("Introduce un email de prueba válido")
      return
    }

    const actionKey = `${event}-${isTest ? "test" : "live"}`
    setSendingAction(actionKey)
    try {
      const res = await fetch("/api/admin/casting/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          customMessage: customNote.trim() || undefined,
          testEmail: isTest ? adminEmail.trim() : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Error enviando emails")
      }

      const r = data.result
      if (isTest) {
        if (r.sent > 0) {
          toast.success(`Email de prueba enviado a ${adminEmail.trim()}`)
        } else if (r.skipped > 0) {
          toast.info("La plantilla está desactivada en Configuración → Emails")
        } else {
          toast.warning("No se pudo entregar el email (revisa el proveedor de correo)")
        }
      } else {
        toast.success(
          `Campaña enviada: ${r.sent} enviados, ${r.skipped} omitidos, ${r.failed} fallidos (de ${r.totalRecipients})`
        )
        setConfirmEvent(null)
      }

      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error enviando campaña")
    } finally {
      setSendingAction(null)
    }
  }

  const previewOpen = formatCastingDate(settings.applicationsOpenDate)
  const previewClose = formatCastingDate(settings.applicationsCloseDate)
  const previewAuditions = formatCastingDateRange(
    settings.auditionsStartDate,
    settings.auditionsEndDate
  )
  const previewResults = formatCastingDate(settings.resultsDate)
  const selectedRecipientCount = audienceStats[settings.notifyAudience] ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Estado de campaña & Fechas Importantes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-5" />
              Campaña y Fechas Importantes
            </CardTitle>
            <CardDescription>
              Controla el estado del casting y las fechas que se muestran en /casting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Campaign Name & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="campaignName">Nombre de la campaña</Label>
                <Input
                  id="campaignName"
                  value={settings.campaignName}
                  onChange={(e) => updateField("campaignName", e.target.value)}
                  placeholder="Ej: Spring Casting 2026"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaignStatus">Estado del casting</Label>
                <Select
                  value={settings.campaignStatus}
                  onValueChange={(val) =>
                    updateField("campaignStatus", val as "open" | "closed")
                  }
                >
                  <SelectTrigger id="campaignStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abierto (acepta solicitudes)</SelectItem>
                    <SelectItem value="closed">Cerrado (no acepta solicitudes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {settings.campaignStatus === "closed" && (
              <div className="space-y-2">
                <Label htmlFor="closedMessage">Mensaje cuando el casting está cerrado</Label>
                <Textarea
                  id="closedMessage"
                  rows={3}
                  value={settings.closedMessage}
                  onChange={(e) => updateField("closedMessage", e.target.value)}
                  placeholder="Mensaje que verán los visitantes en /casting cuando esté cerrado..."
                />
              </div>
            )}

            {/* Toggle Important Dates */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label htmlFor="showImportantDates" className="font-medium">
                  Mostrar bloque &quot;Important Dates&quot; en /casting
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Activa o desactiva la tarjeta de fechas importantes en la barra lateral de /casting
                </p>
              </div>
              <Switch
                id="showImportantDates"
                checked={settings.showImportantDates}
                onCheckedChange={(checked) => updateField("showImportantDates", checked)}
              />
            </div>

            {/* Date Pickers */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="applicationsOpenDate">Apertura de solicitudes (opcional)</Label>
                  <Input
                    id="applicationsOpenDate"
                    type="date"
                    value={settings.applicationsOpenDate}
                    onChange={(e) => updateField("applicationsOpenDate", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si la indicas, el aviso de apertura se enviará automáticamente al llegar esa fecha.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="applicationsCloseDate">Cierre de solicitudes (Applications close)</Label>
                  <Input
                    id="applicationsCloseDate"
                    type="date"
                    value={settings.applicationsCloseDate}
                    onChange={(e) => updateField("applicationsCloseDate", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Al pasar esta fecha, el casting se cerrará automáticamente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="auditionsStartDate">Inicio audiciones (Auditions)</Label>
                  <Input
                    id="auditionsStartDate"
                    type="date"
                    value={settings.auditionsStartDate}
                    onChange={(e) => updateField("auditionsStartDate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auditionsEndDate">Fin audiciones (opcional)</Label>
                  <Input
                    id="auditionsEndDate"
                    type="date"
                    value={settings.auditionsEndDate}
                    onChange={(e) => updateField("auditionsEndDate", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resultsDate">Resultados (Results)</Label>
                  <Input
                    id="resultsDate"
                    type="date"
                    value={settings.resultsDate}
                    onChange={(e) => updateField("resultsDate", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista previa en /casting</CardTitle>
            <CardDescription>
              Así verán los visitantes el aviso de fechas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado actual:</span>
              <Badge
                variant="outline"
                className={
                  settings.campaignStatus === "open"
                    ? "bg-green-500/15 text-green-500 border-green-500/30"
                    : "bg-red-500/15 text-red-500 border-red-500/30"
                }
              >
                {settings.campaignStatus === "open" ? "Casting Abierto" : "Casting Cerrado"}
              </Badge>
            </div>

            {settings.showImportantDates ? (
              previewOpen || previewClose || previewAuditions || previewResults ? (
                <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm mb-2">
                    <Clock className="size-4" />
                    <span>Important Dates</span>
                  </div>
                  {previewOpen && (
                    <p className="text-xs">
                      <span className="font-semibold">Applications open:</span> {previewOpen}
                    </p>
                  )}
                  {previewClose && (
                    <p className="text-xs">
                      <span className="font-semibold">Applications close:</span> {previewClose}
                    </p>
                  )}
                  {previewAuditions && (
                    <p className="text-xs">
                      <span className="font-semibold">Auditions:</span> {previewAuditions}
                    </p>
                  )}
                  {previewResults && (
                    <p className="text-xs">
                      <span className="font-semibold">Results:</span> {previewResults}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                  Activa fechas arriba para mostrar el bloque &quot;Important Dates&quot; en /casting. Si no hay ninguna fecha definida, el bloque se ocultará automáticamente.
                </div>
              )
            ) : (
              <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                El bloque &quot;Important Dates&quot; está <strong>desactivado</strong> y no se mostrará en /casting.
              </div>
            )}

            <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
              {settings.lastOpenedSentAt && (
                <p>
                  Último email de apertura:{" "}
                  {new Date(settings.lastOpenedSentAt).toLocaleString("es-ES")}
                </p>
              )}
              {settings.lastClosedSentAt && (
                <p>
                  Último email de cierre:{" "}
                  {new Date(settings.lastClosedSentAt).toLocaleString("es-ES")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Transactional Campaign Emails */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-5" />
                Notificaciones por Email Transaccional
              </CardTitle>
              <CardDescription>
                Envía avisos automáticos o manuales cuando se abran o cierren las campañas de casting
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/settings">
                <ExternalLink className="size-3.5 mr-1.5" />
                Editar asuntos en Emails
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="pr-3">
                <Label htmlFor="autoNotifyOnOpen" className="font-medium">
                  Aviso automático al abrir casting
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envía la plantilla <code>casting/campaign-opened</code> al abrir la campaña o llegar su fecha de inicio.
                </p>
              </div>
              <Switch
                id="autoNotifyOnOpen"
                checked={settings.autoNotifyOnOpen}
                onCheckedChange={(checked) => updateField("autoNotifyOnOpen", checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="pr-3">
                <Label htmlFor="autoNotifyOnClose" className="font-medium">
                  Aviso automático al cerrar casting
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Envía la plantilla <code>casting/campaign-closed</code> al cerrar la campaña o vencer la fecha límite.
                </p>
              </div>
              <Switch
                id="autoNotifyOnClose"
                checked={settings.autoNotifyOnClose}
                onCheckedChange={(checked) => updateField("autoNotifyOnClose", checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notifyAudience">Destinatarios de la campaña</Label>
              <Select
                value={settings.notifyAudience}
                onValueChange={(val) =>
                  updateField("notifyAudience", val as CastingNotifyAudience)
                }
              >
                <SelectTrigger id="notifyAudience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicants_only">
                    Solo solicitantes y apuntados a alertas de casting ({audienceStats.applicants_only})
                  </SelectItem>
                  <SelectItem value="all_subscribers_and_applicants">
                    Suscriptores newsletter + solicitantes de casting ({audienceStats.all_subscribers_and_applicants})
                  </SelectItem>
                  <SelectItem value="users_and_subscribers">
                    Todos los usuarios registrados + suscriptores + solicitantes ({audienceStats.users_and_subscribers})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testEmail">Email para pruebas rápidas</Label>
              <Input
                id="testEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="tu-email@dominio.com"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Guardar configuración de campaña
            </Button>
          </div>

          {/* Manual Send / Test Section */}
          <div className="pt-5 border-t space-y-4">
            <div>
              <h4 className="text-sm font-semibold">Envío manual o prueba de campaña</h4>
              <p className="text-xs text-muted-foreground">
                Guarda primero tus fechas si las has modificado. Puedes enviarte un correo de prueba o lanzar el aviso ahora mismo a los {selectedRecipientCount} destinatarios seleccionados.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customNote">Nota opcional para el email</Label>
              <Textarea
                id="customNote"
                rows={2}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Ej: ¡Últimos días para apuntarte al casting de primavera!"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingAction !== null}
                onClick={() => handleDispatch("opened", true)}
              >
                {sendingAction === "opened-test" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Probar email &quot;Casting Abierto&quot;
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sendingAction !== null}
                onClick={() => handleDispatch("closed", true)}
              >
                {sendingAction === "closed-test" && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Probar email &quot;Casting Cerrado&quot;
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={sendingAction !== null || selectedRecipientCount === 0}
                onClick={() => setConfirmEvent("opened")}
              >
                <Send className="mr-1.5 size-3.5" />
                Enviar &quot;Casting Abierto&quot; ({selectedRecipientCount})
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={sendingAction !== null || selectedRecipientCount === 0}
                onClick={() => setConfirmEvent("closed")}
              >
                <Send className="mr-1.5 size-3.5" />
                Enviar &quot;Casting Cerrado&quot; ({selectedRecipientCount})
              </Button>
            </div>

            {confirmEvent && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-amber-500/40 bg-amber-500/10">
                <div className="flex items-start gap-2.5 text-sm">
                  <AlertCircle className="size-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span>
                    ¿Confirmas el envío del email transaccional de{" "}
                    <strong>
                      {confirmEvent === "opened" ? "Casting Abierto" : "Casting Cerrado"}
                    </strong>{" "}
                    a <strong>{selectedRecipientCount}</strong> destinatario(s)?
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmEvent(null)}
                    disabled={sendingAction !== null}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleDispatch(confirmEvent, false)}
                    disabled={sendingAction !== null}
                  >
                    {sendingAction?.endsWith("-live") && (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    )}
                    Confirmar envío
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Recent Email Logs */}
          {recentLogs.length > 0 && (
            <div className="pt-5 border-t space-y-2">
              <h4 className="text-sm font-semibold">Últimos envíos de campaña</h4>
              <div className="divide-y border rounded-lg">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {log.status === "sent" ? (
                        <CheckCircle2 className="size-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{log.to}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {log.template === "casting/campaign-opened" ? "Apertura" : "Cierre"}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-2">
                      <span>{log.status}</span>
                      <span>·</span>
                      <span>
                        {new Date(log.createdAt).toLocaleString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
