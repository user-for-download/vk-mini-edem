// backend/src/middleware/rateLimit.ts
import type { Context, Next } from "hono";

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
      return c.json({ message: "Too many requests" }, 429);
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);

    return next();
  };
}
