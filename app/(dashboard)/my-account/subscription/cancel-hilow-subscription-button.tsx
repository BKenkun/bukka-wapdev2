"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { safeParseJson } from "@/lib/safe-json"

interface CancelHilowSubscriptionButtonProps {
  cancelAtPeriodEnd: boolean
  periodEndFormatted: string
}

export function CancelHilowSubscriptionButton({
  cancelAtPeriodEnd: initialCancelAtPeriodEnd,
  periodEndFormatted,
}: CancelHilowSubscriptionButtonProps) {
  const router = useRouter()
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(initialCancelAtPeriodEnd)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (cancelAtPeriodEnd) {
    return (
      <p
        className="text-xs font-montserrat mt-2"
        style={{ color: "var(--warning-color, #f59e0b)" }}
      >
        Cancellation scheduled — your access remains active until {periodEndFormatted}.
      </p>
    )
  }

  const handleConfirmCancel = async () => {
    setSubmitting(true)
    try {
      const res = await fetch("/api/payments/hilow/cancel-subscription", {
        method: "POST",
        credentials: "include",
      })
      const data = await safeParseJson<{ error?: string }>(res)
      if (!res.ok) {
        toast.error(data?.error || "Could not cancel subscription")
        return
      }

      setCancelAtPeriodEnd(true)
      setConfirming(false)
      toast.success(
        `Subscription cancelled. You keep full access until ${periodEndFormatted}.`
      )
      router.refresh()
    } catch {
      toast.error("Could not cancel subscription")
    } finally {
      setSubmitting(false)
    }
  }

  if (confirming) {
    return (
      <div className="mt-3 p-3 border border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs font-montserrat flex-1" style={{ color: "var(--text-primary)" }}>
          Cancel auto-renewal? You will keep access until {periodEndFormatted}.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-xs font-montserrat border border-[var(--border-color)] hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-primary)" }}
          >
            Keep plan
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirmCancel}
            className="px-3 py-1.5 text-xs font-montserrat bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {submitting ? "Cancelling..." : "Confirm cancel"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="mt-2 text-xs font-montserrat underline hover:opacity-80 transition-opacity"
      style={{ color: "var(--text-muted)" }}
    >
      Cancel subscription at end of billing period
    </button>
  )
}
