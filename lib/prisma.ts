import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { Pool } from "pg"
import ws from "ws"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function sanitizeNeonUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl)
    parsed.searchParams.delete("channel_binding")
    return parsed.toString()
  } catch {
    return rawUrl
  }
}

function isNeonUrl(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).hostname.includes("neon.tech")
  } catch {
    return rawUrl.includes("neon.tech")
  }
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined")
  }

  if (isNeonUrl(connectionString)) {
    neonConfig.webSocketConstructor = ws
    const adapter = new PrismaNeon({
      connectionString: sanitizeNeonUrl(connectionString),
    })
    return new PrismaClient({ adapter })
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({ adapter })
}

function createMockPrismaClient(): PrismaClient {
  const noOpModel = {
    findMany: async () => [],
    findFirst: async () => null,
    findFirstOrThrow: async () => null,
    findUnique: async () => null,
    findUniqueOrThrow: async () => null,
    count: async () => 0,
    aggregate: async () => ({ _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} }),
    groupBy: async () => [],
    create: async (d?: { data?: unknown }) => d?.data ?? {},
    createMany: async () => ({ count: 0 }),
    update: async (d?: { data?: unknown }) => d?.data ?? {},
    updateMany: async () => ({ count: 0 }),
    upsert: async (d?: { create?: unknown; update?: unknown }) => d?.create ?? d?.update ?? {},
    delete: async () => ({}),
    deleteMany: async () => ({ count: 0 }),
  }

  const mockClient = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "$transaction") {
          return async (arg: unknown) =>
            Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mockClient)
        }
        if (prop === "$connect" || prop === "$disconnect") {
          return async () => undefined
        }
        if (prop === "$queryRaw" || prop === "$queryRawUnsafe") {
          return async () => []
        }
        if (prop === "$executeRaw" || prop === "$executeRawUnsafe") {
          return async () => 0
        }
        if (prop === "$on" || prop === "$use") {
          return () => undefined
        }
        return noOpModel
      },
    }
  )

  return mockClient as unknown as PrismaClient
}

let prismaInstance: PrismaClient
try {
  prismaInstance = globalForPrisma.prisma ?? createPrismaClient()
} catch {
  console.warn("[AI Studio] Database not connected — using mock")
  prismaInstance = createMockPrismaClient()
}

export const prisma = prismaInstance

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
