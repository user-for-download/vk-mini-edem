// backend/src/middleware/rateLimit.ts
import type { Context, Next } from "hono";
import { ERROR_CODES } from "../errors.js";

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
    const forwardedFor = c.req.header("x-forwarded-for");
    const realIp = c.req.header("x-real-ip");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      realIp ||
      "unknown";

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
