"use client"

import { Suspense, useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "@/components/ui/sonner"
import { SubscriptionProvider } from "@/components/subscription-provider"
import { AuthModalProvider } from "@/components/auth/auth-modal-provider"
import { SessionTimeoutProvider } from "@/components/auth/session-timeout-provider"
import { SessionTimeoutModal } from "@/components/auth/session-timeout-modal"
import { ReferralAttribution } from "@/components/referral-attribution"

interface ProvidersProps {
  children: React.ReactNode
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    const handleResizeObserverLoopError = (event: ErrorEvent) => {
      if (
        event.message === "ResizeObserver loop completed with undelivered notifications." ||
        event.message === "ResizeObserver loop limit exceeded"
      ) {
        event.stopImmediatePropagation()
        event.preventDefault()
      }
    }

    window.addEventListener("error", handleResizeObserverLoopError, true)
    return () => {
      window.removeEventListener("error", handleResizeObserverLoopError, true)
    }
  }, [])

  return (
    <SessionProvider>
      <SubscriptionProvider>
        <AuthModalProvider>
          <SessionTimeoutProvider>
            <Suspense fallback={null}>
              <ReferralAttribution />
            </Suspense>
            {children}
            <SessionTimeoutModal />
            <Toaster />
          </SessionTimeoutProvider>
        </AuthModalProvider>
      </SubscriptionProvider>
    </SessionProvider>
  )
}
