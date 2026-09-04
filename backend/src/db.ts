import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { env } from "./env.js";

/**
 * В production логируем только warn/error.
 * В development логируем все запросы для отладки.
 *
 * Prisma 7: подключение — через pg driver-адаптер (встроенного Rust-движка
 * нет). Параметры пула задаются в коде: node-pg игнорирует
 * connection_limit/pool_timeout из DATABASE_URL (параметры старого
 * Rust-движка), поэтому являем их здесь:
 *   max: 10, connectionTimeoutMillis: 10_000
 * (соответствует ?connection_limit=10&pool_timeout=10 в docker-compose URL).
 */
export const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 10_000,
  }),
  log: env.isProduction
    ? ["warn", "error"]
    : ["query", "warn", "error"],
});
