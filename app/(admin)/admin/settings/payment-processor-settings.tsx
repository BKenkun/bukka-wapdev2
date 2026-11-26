"use client"

import * as React from "react"
import {
  IconCreditCard,
  IconLoader2,
  IconCheck,
  IconAlertTriangle,
  IconCopy,
  IconShoppingBag,
  IconRepeat,
  IconShieldCheck,
  IconRefresh,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

type PaymentProcessor = "easierpay" | "hilow"

interface PaymentGatewaysDiagnostics {
  baseUrl: string
  easierpay: {
    apiConfigured: boolean
    testMode: boolean
    commerce: string
    webhookUrl: string
  }
  hilow: {
    apiConfigured: boolean
    webhookSecretConfigured: boolean
    storeId: string
    webhookUrl: string
  }
}

interface HilowConnectionDiagnostics {
  apiConfigured: boolean
  webhookSecretConfigured: boolean
  storeId: string
  baseUrl: string
  apiBaseUrl: string
  webhookUrl: string
  apiOrdersProbe: {
    reachable: boolean
    authenticated: boolean
    merchantEnabled: boolean
    statusCode: number | null
    message: string
  }
  apiSubscriptionProbe: {
    reachable: boolean
    statusCode: number | null
    message: string
  }
  webhookSignatureSelfTest: {
    passed: boolean
    reason: string
  }
  webhookPublicReachability: {
    reachable: boolean
    statusCode: number | null
    message: string
  }
}

interface PaymentProcessorState {
  shopProcessor: PaymentProcessor
  subscriptionProcessor: PaymentProcessor
  diagnostics: PaymentGatewaysDiagnostics | null
}

export function PaymentProcessorSettings() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTestingHilow, setIsTestingHilow] = React.useState(false)
  const [hilowTestResult, setHilowTestResult] =
    React.useState<HilowConnectionDiagnostics | null>(null)
  const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null)
  const [state, setState] = React.useState<PaymentProcessorState>({
    shopProcessor: "easierpay",
    subscriptionProcessor: "easierpay",
    diagnostics: null,
  })

  React.useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch("/api/admin/settings/payment-processor")
        if (res.ok && active) {
          const data = await res.json()
          setState({
            shopProcessor: data.shopProcessor === "hilow" ? "hilow" : "easierpay",
            subscriptionProcessor:
              data.subscriptionProcessor === "hilow" ? "hilow" : "easierpay",
            diagnostics: data.diagnostics || null,
          })
        }
      } catch (error) {
        console.error("Error loading payment processor settings:", error)
        toast.error("No se pudo cargar la configuración de pagos")
      } finally {
        if (active) setIsLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/settings/payment-processor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopProcessor: state.shopProcessor,
          subscriptionProcessor: state.subscriptionProcessor,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Error al guardar")
      }

      const data = await res.json()
      setState((prev) => ({
        shopProcessor: data.shopProcessor === "hilow" ? "hilow" : "easierpay",
        subscriptionProcessor:
          data.subscriptionProcessor === "hilow" ? "hilow" : "easierpay",
        diagnostics: data.diagnostics || prev.diagnostics,
      }))
      toast.success("Configuración de procesador de pagos guardada")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al guardar la configuración"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      toast.success("URL del webhook copiada")
      setTimeout(() => {
        setCopiedUrl((current) => (current === url ? null : current))
      }, 2000)
    } catch {
      toast.error("No se pudo copiar la URL")
    }
  }

  const handleTestHilow = async () => {
    setIsTestingHilow(true)
    try {
      const res = await fetch("/api/admin/settings/payment-processor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-hilow" }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.hilowDiagnostics) {
        throw new Error(data?.error || "Error al verificar la conexión con Hilow")
      }
      setHilowTestResult(data.hilowDiagnostics)
      const ok =
        data.hilowDiagnostics.apiOrdersProbe.authenticated &&
        data.hilowDiagnostics.apiOrdersProbe.merchantEnabled &&
        data.hilowDiagnostics.webhookSignatureSelfTest.passed
      if (ok) {
        toast.success("Conexión con Hilow verificada")
      } else {
        toast.warning("La verificación de Hilow detectó incidencias")
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo verificar la conexión con Hilow"
      )
    } finally {
      setIsTestingHilow(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const diag = state.diagnostics
  const hilowSelectedAnywhere =
    state.shopProcessor === "hilow" || state.subscriptionProcessor === "hilow"
  const easierpaySelectedAnywhere =
    state.shopProcessor === "easierpay" ||
    state.subscriptionProcessor === "easierpay"

  const hilowMissingCreds =
    hilowSelectedAnywhere &&
    diag &&
    (!diag.hilow.apiConfigured || !diag.hilow.webhookSecretConfigured)

  const easierpayMissingCreds =
    easierpaySelectedAnywhere && diag && !diag.easierpay.apiConfigured

  return (
    <div className="space-y-6">
      {/* Selector Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard className="size-5" />
            Procesador de Pagos Principal
          </CardTitle>
          <CardDescription>
            Elige de forma independiente si los nuevos cobros de Tienda y Suscripciones se procesan con EasierPay o con Hilow Global.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/40 p-4 flex items-start gap-3">
            <IconShieldCheck className="size-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium">
                Continuidad automática en segundo plano
              </p>
              <p className="text-muted-foreground">
                Ambas pasarelas permanecen siempre activas por detrás. Cambiar estos interruptores solo define el camino principal para los <strong>nuevos</strong> pagos; las suscripciones ya activas en Hilow o EasierPay seguirán renovándose, cancelándose y procesando webhooks en su pasarela original sin interrupciones.
              </p>
            </div>
          </div>

          {/* Interruptor Tienda */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <IconShoppingBag className="size-4 text-muted-foreground" />
                <Label htmlFor="shop-processor-switch" className="text-base font-medium">
                  Tienda (Pedidos puntuales)
                </Label>
                <Badge variant={state.shopProcessor === "hilow" ? "default" : "secondary"}>
                  {state.shopProcessor === "hilow" ? "Hilow Global" : "EasierPay"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Desactivado: cobra pedidos nuevos con <strong>EasierPay</strong>. Activado: cobra pedidos nuevos con <strong>Hilow Global</strong>.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-sm ${
                  state.shopProcessor === "easierpay"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                EasierPay
              </span>
              <Switch
                id="shop-processor-switch"
                checked={state.shopProcessor === "hilow"}
                onCheckedChange={(checked) =>
                  setState((prev) => ({
                    ...prev,
                    shopProcessor: checked ? "hilow" : "easierpay",
                  }))
                }
              />
              <span
                className={`text-sm ${
                  state.shopProcessor === "hilow"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Hilow
              </span>
            </div>
          </div>

          <Separator />

          {/* Interruptor Suscripciones */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <IconRepeat className="size-4 text-muted-foreground" />
                <Label htmlFor="subscription-processor-switch" className="text-base font-medium">
                  Suscripciones (Planes mensuales)
                </Label>
                <Badge
                  variant={
                    state.subscriptionProcessor === "hilow" ? "default" : "secondary"
                  }
                >
                  {state.subscriptionProcessor === "hilow"
                    ? "Hilow Global"
                    : "EasierPay"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Desactivado: altas nuevas con <strong>EasierPay</strong>. Activado: altas nuevas con <strong>Hilow Global</strong> (con soporte para múltiples planes, descuento en 1.er mes por referido y cancelación a fin de ciclo).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-sm ${
                  state.subscriptionProcessor === "easierpay"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                EasierPay
              </span>
              <Switch
                id="subscription-processor-switch"
                checked={state.subscriptionProcessor === "hilow"}
                onCheckedChange={(checked) =>
                  setState((prev) => ({
                    ...prev,
                    subscriptionProcessor: checked ? "hilow" : "easierpay",
                  }))
                }
              />
              <span
                className={`text-sm ${
                  state.subscriptionProcessor === "hilow"
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Hilow
              </span>
            </div>
          </div>

          {/* Avisos si faltan variables en entorno */}
          {hilowMissingCreds && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-sm">
              <IconAlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">
                  Faltan variables de entorno de Hilow Global
                </p>
                <p className="text-muted-foreground">
                  Asegúrate de configurar <code>HILOW_API_KEY</code> y{" "}
                  <code>HILOW_WEBHOOK_SECRET</code> en el servidor (AWS) antes de cobrar en producción con Hilow.
                </p>
              </div>
            </div>
          )}

          {easierpayMissingCreds && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start gap-2.5 text-sm">
              <IconAlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-500">
                  Falta la variable de entorno de EasierPay
                </p>
                <p className="text-muted-foreground">
                  Configura <code>EASIERPAY_BEARER_TOKEN</code> en el servidor para iniciar cobros con EasierPay.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado de Pasarelas y Webhooks */}
      {diag && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* EasierPay */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">EasierPay</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Webhook siempre activo
                </Badge>
              </div>
              <CardDescription>
                Comercio configurado: <code>{diag.easierpay.commerce}</code>
                {diag.easierpay.testMode ? " · Modo pruebas (testmode)" : " · Producción"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">EASIERPAY_BEARER_TOKEN</span>
                {diag.easierpay.apiConfigured ? (
                  <Badge variant="secondary" className="gap-1 text-emerald-500">
                    <IconCheck className="size-3.5" />
                    Configurada
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <IconAlertTriangle className="size-3.5" />
                    No configurada
                  </Badge>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  URL del Webhook (EasierPay)
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2.5 py-1.5 text-xs truncate">
                    {diag.easierpay.webhookUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(diag.easierpay.webhookUrl)}
                  >
                    {copiedUrl === diag.easierpay.webhookUrl ? (
                      <IconCheck className="size-4 text-emerald-500" />
                    ) : (
                      <IconCopy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hilow Global */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">Hilow Global</CardTitle>
                <Badge variant="outline" className="text-xs">
                  Webhook siempre activo
                </Badge>
              </div>
              <CardDescription>
                Store ID: <code>{diag.hilow.storeId}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">HILOW_API_KEY</span>
                  {diag.hilow.apiConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-emerald-500">
                      <IconCheck className="size-3.5" />
                      Configurada
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <IconAlertTriangle className="size-3.5" />
                      No configurada
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">HILOW_WEBHOOK_SECRET</span>
                  {diag.hilow.webhookSecretConfigured ? (
                    <Badge variant="secondary" className="gap-1 text-emerald-500">
                      <IconCheck className="size-3.5" />
                      Configurada
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <IconAlertTriangle className="size-3.5" />
                      No configurada
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  URL del Webhook (registrar en el panel de Hilow)
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2.5 py-1.5 text-xs truncate">
                    {diag.hilow.webhookUrl}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(diag.hilow.webhookUrl)}
                  >
                    {copiedUrl === diag.hilow.webhookUrl ? (
                      <IconCheck className="size-4 text-emerald-500" />
                    ) : (
                      <IconCopy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Diagnóstico en vivo (API y Webhook)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestHilow}
                    disabled={isTestingHilow}
                  >
                    {isTestingHilow ? (
                      <IconLoader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <IconRefresh className="mr-1.5 size-3.5" />
                    )}
                    Verificar conexión
                  </Button>
                </div>

                {hilowTestResult && (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">API Órdenes (/api/orders)</span>
                      <span
                        className={
                          hilowTestResult.apiOrdersProbe.authenticated &&
                          hilowTestResult.apiOrdersProbe.merchantEnabled
                            ? "text-emerald-500 font-medium"
                            : "text-amber-500 font-medium"
                        }
                      >
                        {hilowTestResult.apiOrdersProbe.authenticated &&
                        hilowTestResult.apiOrdersProbe.merchantEnabled
                          ? `Operativa (${hilowTestResult.apiOrdersProbe.statusCode})`
                          : `${hilowTestResult.apiOrdersProbe.message} (${hilowTestResult.apiOrdersProbe.statusCode ?? "error"})`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Firma Webhook HMAC-SHA256</span>
                      <span
                        className={
                          hilowTestResult.webhookSignatureSelfTest.passed
                            ? "text-emerald-500 font-medium"
                            : "text-destructive font-medium"
                        }
                      >
                        {hilowTestResult.webhookSignatureSelfTest.reason}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Acceso público Webhook</span>
                      <span
                        className={
                          hilowTestResult.webhookPublicReachability.reachable
                            ? "text-emerald-500 font-medium"
                            : "text-amber-500 font-medium"
                        }
                      >
                        {hilowTestResult.webhookPublicReachability.message}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
