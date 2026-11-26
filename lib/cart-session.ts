import { cookies, headers } from "next/headers"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export const CART_COOKIE = "cart_session_id"
export const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

async function shouldUseCrossSiteCartCookie(): Promise<boolean> {
  if (
    Boolean(process.env.K_SERVICE) ||
    process.env.AUTH_COOKIE_SAMESITE === "none"
  ) {
    return true
  }

  try {
    const hdrs = await headers()
    const proto = hdrs.get("x-forwarded-proto") || ""
    const fetchSite = hdrs.get("sec-fetch-site") || ""
    const fetchDest = hdrs.get("sec-fetch-dest") || ""
    const isHttps = proto.includes("https") || process.env.NODE_ENV === "production"
    if (isHttps && (fetchSite === "cross-site" || fetchDest === "iframe")) {
      return true
    }
  } catch {
    // Ignore when called outside a request headers context
  }

  return false
}

async function getCartCookieOptions(maxAge: number) {
  const crossSite = await shouldUseCrossSiteCartCookie()
  if (crossSite) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
      partitioned: true,
      path: "/",
      maxAge,
    }
  }

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export async function getCartSessionId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(CART_COOKIE)?.value ?? null
}

export async function ensureCartSessionId(): Promise<string> {
  const jar = await cookies()
  const current = jar.get(CART_COOKIE)?.value
  if (current) return current

  const id = randomBytes(16).toString("hex")
  const options = await getCartCookieOptions(CART_COOKIE_MAX_AGE_SECONDS)
  jar.set(CART_COOKIE, id, options)
  return id
}

export async function clearCartSessionCookie() {
  const jar = await cookies()
  const options = await getCartCookieOptions(0)
  jar.set(CART_COOKIE, "", options)
}

/**
 * Merge a guest cart (identified by cookie sessionId) into the user's cart
 * when they sign in. If the user has no cart yet, the guest cart is
 * reassigned; otherwise items are merged by (productId, variantId) adding
 * quantities. The guest cart cookie is cleared on success.
 */
export async function mergeGuestCartIntoUser(userId: string) {
  let sessionId: string | null = null
  try {
    const jar = await cookies()
    sessionId = jar.get(CART_COOKIE)?.value ?? null
    if (!sessionId) return
  } catch {
    return
  }

  try {
    const guestCart = await prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    })

    if (!guestCart || guestCart.items.length === 0) {
      await clearCartSessionCookie()
      if (guestCart) {
        await prisma.cart.delete({ where: { id: guestCart.id } }).catch(() => {})
      }
      return
    }

    const userCart = await prisma.cart.findUnique({ where: { userId } })

    if (!userCart) {
      await prisma.cart.update({
        where: { id: guestCart.id },
        data: { userId, sessionId: null },
      })
    } else {
      for (const item of guestCart.items) {
        const existing = await prisma.cartItem.findFirst({
          where: {
            cartId: userCart.id,
            productId: item.productId,
            variantId: item.variantId,
          },
        })
        if (existing) {
          await prisma.cartItem.update({
            where: { id: existing.id },
            data: { quantity: existing.quantity + item.quantity },
          })
        } else {
          await prisma.cartItem.create({
            data: {
              cartId: userCart.id,
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            },
          })
        }
      }
      await prisma.cart.delete({ where: { id: guestCart.id } })
    }

    await clearCartSessionCookie()
  } catch (error) {
    console.error("Failed to merge guest cart:", error)
  }
}
