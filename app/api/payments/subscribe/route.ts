import { NextRequest } from "next/server"
import { getPaymentProcessorSettings } from "@/lib/payment-settings"
import { POST as subscribeEasierPay } from "@/app/api/payments/easierpay/subscribe/route"
import { POST as subscribeHilow } from "@/app/api/payments/hilow/subscribe/route"

export async function POST(request: NextRequest) {
  const { subscriptionProcessor } = await getPaymentProcessorSettings()

  if (subscriptionProcessor === "hilow") {
    return subscribeHilow(request)
  }

  return subscribeEasierPay(request)
}
