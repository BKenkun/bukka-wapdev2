import type { NextAuthConfig } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { type JWT } from "next-auth/jwt"

/**
 * Auth config for Edge runtime (proxy/middleware)
 * This file must NOT import Prisma or any Node.js-only modules
 */

interface SubscriptionPlanData {
  id: string
  slug: string
  name: string
  level: number
  maxVideoQuality: string
  canComment: boolean
  canAccessForum: boolean
  canDownload: boolean
  canAccessExclusive: boolean
  canAccessLimitedEdition: boolean
  shopDiscount: number
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string | null
      image: string | null
      isAdmin: boolean
      adminRole: string | null
      SubscriptionPlan: SubscriptionPlanData | null
      subscriptionEnd: Date | null
      signedInAt: number | null
    }
  }
  interface User {
    isAdmin?: boolean
    adminRole?: string | null
    SubscriptionPlan?: SubscriptionPlanData | null
    subscriptionEnd?: Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    isAdmin?: boolean
    adminRole?: string | null
    SubscriptionPlan?: SubscriptionPlanData | null
    subscriptionEnd?: Date | null
    signedInAt?: number | null
  }
}

function generateRuntimeFallbackSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

const globalForAuth = globalThis as unknown as { __nextAuthFallbackSecret?: string }
const fallbackSecret =
  globalForAuth.__nextAuthFallbackSecret ??
  (globalForAuth.__nextAuthFallbackSecret = generateRuntimeFallbackSecret())

const useCrossSiteCookies =
  Boolean(process.env.K_SERVICE) || process.env.AUTH_COOKIE_SAMESITE === "none"

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || fallbackSecret,
  logger: {
    error(error) {
      const errorType = (error as { type?: string }).type || error.name || ""
      const causeObj = error.cause as { err?: unknown } | Error | undefined
      const causeErr =
        causeObj instanceof Error
          ? causeObj
          : causeObj && typeof causeObj === "object" && "err" in causeObj && causeObj.err instanceof Error
            ? causeObj.err
            : undefined
      const causeMessage = causeErr?.message || error.message || ""

      // Expected invalid credentials attempts throw CredentialsSignin inside Auth.js and are
      // returned cleanly to the login UI via signIn() result.error — do not log as server crashes.
      if (errorType === "CredentialsSignin") {
        return
      }

      // Stale or rotated session cookies fail JWT decryption cleanly (Auth.js returns null session).
      // Suppress expected decryption-mismatch noise so it does not spam server/browser error consoles.
      if (
        errorType === "JWTSessionError" &&
        (causeMessage.includes("no matching decryption secret") ||
          causeMessage.includes("decryption operation failed"))
      ) {
        return
      }

      console.error(`[auth][error] ${errorType}: ${error.message}`)
      if (causeErr?.stack) {
        console.error(`[auth][cause]:`, causeErr.stack)
      } else if (error.stack) {
        console.error(error.stack)
      }
    },
  },
  ...(useCrossSiteCookies
    ? {
        useSecureCookies: true,
        cookies: {
          sessionToken: {
            name: "__Secure-authjs.session-token",
            options: {
              httpOnly: true,
              sameSite: "none",
              path: "/",
              secure: true,
              partitioned: true,
            },
          },
          callbackUrl: {
            name: "__Secure-authjs.callback-url",
            options: {
              sameSite: "none",
              path: "/",
              secure: true,
              partitioned: true,
            },
          },
          csrfToken: {
            name: "__Host-authjs.csrf-token",
            options: {
              httpOnly: true,
              sameSite: "none",
              path: "/",
              secure: true,
              partitioned: true,
            },
          },
        },
      }
    : {}),
  providers: [
    // Credentials provider configured in auth.ts with Prisma
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is set in auth.ts
      authorize: () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isAdmin = user.isAdmin
        token.adminRole = user.adminRole
        token.SubscriptionPlan = user.SubscriptionPlan
        token.subscriptionEnd = user.subscriptionEnd
        token.signedInAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.isAdmin = (token.isAdmin as boolean) ?? false
        session.user.adminRole = (token.adminRole as string | null) ?? null
        session.user.SubscriptionPlan = (token.SubscriptionPlan as SubscriptionPlanData | null) ?? null
        session.user.subscriptionEnd = (token.subscriptionEnd as Date | null) ?? null
        session.user.signedInAt = (token.signedInAt as number | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
}
