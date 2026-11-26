import { NextRequest } from "next/server"
import { getPaymentProcessorSettings } from "@/lib/payment-settings"
import { POST as initiateEasierPay } from "@/app/api/payments/easierpay/initiate/route"
import { POST as initiateHilow } from "@/app/api/payments/hilow/initiate/route"

export async function POST(request: NextRequest) {
  const { shopProcessor } = await getPaymentProcessorSettings()

  if (shopProcessor === "hilow") {
    return initiateHilow(request)
  }

  return initiateEasierPay(request)
}
