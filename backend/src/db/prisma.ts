// Prisma client singleton with HMR-safe globalThis pattern + pino integration.
// Uses @prisma/adapter-pg because the schema declares Unsupported("vector(1536)")
// for SecurityPolicy.embedding — the standard prisma-client-js driver can't speak
// pgvector without the adapter.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadConfig } from "../config/env";
import { getLogger } from "../utils/logger";

declare global {
  // Holds the single PrismaClient across module reloads in dev (tsx --watch / HMR).
  // In production this stays undefined; the module-scoped `cached` is enough.
  // eslint-disable-next-line no-var
  var __prismaSingleton: PrismaClient | undefined;
}

let cached: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (cached) return cached;
  if (globalThis.__prismaSingleton) {
    cached = globalThis.__prismaSingleton;
    return cached;
  }

  const config = loadConfig();
  const logger = getLogger();

  const adapter = new PrismaPg({ connectionString: config.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "info" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  // Funnel Prisma's structured events into pino. The pino LOG_LEVEL filter
  // decides what actually surfaces — Prisma always emits.
  prisma.$on("query", (e) => {
    logger.debug({ durationMs: e.duration, params: e.params }, e.query);
  });
  prisma.$on("info", (e) => {
    logger.info({ target: e.target }, e.message);
  });
  prisma.$on("warn", (e) => {
    logger.warn({ target: e.target }, e.message);
  });
  prisma.$on("error", (e) => {
    logger.error({ target: e.target }, e.message);
  });

  cached = prisma;
  if (config.NODE_ENV !== "production") {
    globalThis.__prismaSingleton = prisma;
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (cached) {
    await cached.$disconnect();
  }
  cached = null;
  globalThis.__prismaSingleton = undefined;
}
