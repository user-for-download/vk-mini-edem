import { PrismaClient } from "@prisma/client";
import { env } from "./env.js";

/**
 * В production логируем только warn/error.
 * В development логируем все запросы для отладки.
 *
 * Connection limit задаётся в DATABASE_URL:
 *   postgresql://...?connection_limit=10&pool_timeout=10
 */
export const db = new PrismaClient({
  log: env.isProduction
    ? ["warn", "error"]
    : ["query", "warn", "error"],
});
