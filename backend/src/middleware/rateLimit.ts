// backend/src/middleware/rateLimit.ts
import type { Context, Next } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { ERROR_CODES } from "../errors.js";
import { env } from "../env.js";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

interface RateBucket {
  timestamps: number[];
}

/**
 * Простой in-memory rate limiter.
 *
 * Подходит для одного инстанса.
 * Для production с несколькими инстансами лучше использовать Redis.
 *
 * Ключ строится по IP клиента:
 * - за доверенным прокси (env.TRUST_PROXY) — из заголовков X-Real-IP / X-Forwarded-For,
 *   которые прокси перезаписывает (подделать их снаружи нельзя);
 * - при прямом подключении — из TCP-сокета (getConnInfo), неподделываемый.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();

  const cleanupTimer = setInterval(() => {
    const now = Date.now();

    for (const [key, bucket] of buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter(
        (timestamp) => now - timestamp < options.windowMs
      );

      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  }, options.windowMs);

  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  return async function rateLimiter(c: Context, next: Next) {
    const ip = resolveClientIp(c);

    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();

    const bucket = buckets.get(key) ?? { timestamps: [] };

    bucket.timestamps = bucket.timestamps.filter(
      (timestamp) => now - timestamp < options.windowMs
    );

    if (bucket.timestamps.length >= options.max) {
      return c.json({ code: ERROR_CODES.RATE_LIMITED, message: "Too many requests" }, 429);
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);

    return next();
  };
}

function resolveClientIp(c: Context): string {
  if (env.TRUST_PROXY) {
    // Прокси (Nginx) должен перезаписывать заголовки, а не дополнять:
    //   proxy_set_header X-Real-IP $remote_addr;
    //   proxy_set_header X-Forwarded-For $remote_addr;
    // Иначе левый (первый) хоп в X-Forwarded-For подделывается клиентом.
    return (
      c.req.header("x-real-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    );
  }

  try {
    const connInfo = getConnInfo(c);
    return connInfo.remote.address || "unknown";
  } catch {
    // Фоллбек для сред, где getConnInfo недоступен (например, vitest app.request).
    // X-Forwarded-For без доверенного прокси подделывается клиентом —
    // в production не используем его, иначе лимитер обходится по заголовку.
    if (env.TRUST_PROXY) {
      return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    }
    return "unknown";
  }
}

// ─── Пресеты лимитеров ──────────────────────────────────────────────────────

/**
 * Лимитер для публичных GET-эндпоинтов (поиск, профили, отзывы).
 * 100 запросов в минуту с одного IP.
 */
export const publicReadLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: "public-read",
});

/**
 * Лимитер для мутаций (создание поездок, броней, отзывов).
 * 30 запросов в минуту с одного IP.
 */
export const mutationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: "mutation",
});
