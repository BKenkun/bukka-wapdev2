import { NextRequest } from "next/server"
import { handlers } from "@/auth"

function withForwardedUrl(req: NextRequest): NextRequest {
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const host = rawHost?.split(",")[0].trim()
  if (!host || host.startsWith("0.0.0.0") || host === req.nextUrl.host) {
    return req
  }
  const protoHeader = req.headers.get("x-forwarded-proto")
  const protocol = protoHeader ? `${protoHeader.split(",")[0].trim()}:` : req.nextUrl.protocol
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `${protocol}//${host}`)

  if (req.method === "GET" || req.method === "HEAD") {
    return new NextRequest(url, { headers: req.headers, method: req.method })
  }
  return new NextRequest(url, {
    headers: req.headers,
    method: req.method,
    body: req.body,
    duplex: "half",
  })
}

export async function GET(req: NextRequest) {
  return handlers.GET(withForwardedUrl(req))
}

export async function POST(req: NextRequest) {
  return handlers.POST(withForwardedUrl(req))
}
