import { Hono } from "hono";
import { cors } from "hono/cors";

import { authRouter } from "./auth/index.js";
import { tripsRouter } from "./trips/index.js";
import { bookingsRouter } from "./bookings/index.js";
import { reviewsRouter } from "./reviews/index.js";
import { usersRouter } from "./users/index.js";

import { env } from "./env.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { Sentry } from "./sentry.js";
import { ERROR_CODES } from "./errors.js";

export const app = new Hono();

const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin: string | undefined) => {
      if (!origin) {
        return undefined;
      }
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return undefined;
    },
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  })
);

/**
 * Структурированный access-log.
 */
app.use("*", async (c, next) => {
  const startedAt = Date.now();

  await next();

  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Date.now() - startedAt,
    },
    "http_request"
  );
});

/**
 * Security headers.
 */
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "0");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (env.isProduction) {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
});

/**
 * Ограничение размера тела запроса (100 KB).
 */
const MAX_BODY_SIZE = 100 * 1024;
app.use("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_SIZE) {
    return c.json({ code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: "Payload too large" }, 413);
  }
  await next();
});

/**
 * Проверка подключения к БД.
 */
async function checkDatabase(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

app.get("/health", async (c) => {
  const dbOk = await checkDatabase();
  return c.json(
    {
      status: dbOk ? "ok" : "degraded",
      service: "edem-backend",
      db: dbOk,
      time: new Date().toISOString(),
    },
    dbOk ? 200 : 503
  );
});

app.get("/health/live", (c) => {
  return c.json({ status: "alive" });
});

app.get("/health/ready", async (c) => {
  const dbOk = await checkDatabase();
  return c.json({ ready: dbOk }, dbOk ? 200 : 503);
});

app.route("/api/auth", authRouter);
app.route("/api/trips", tripsRouter);
app.route("/api/bookings", bookingsRouter);
app.route("/api/reviews", reviewsRouter);
app.route("/api/users", usersRouter);

/**
 * Глобальная обработка ошибок.
 */
app.onError((error, c) => {
  logger.error(
    {
      err: error,
      method: c.req.method,
      path: c.req.path,
    },
    "unhandled_error"
  );

  if (env.SENTRY_DSN) {
    Sentry.captureException(error);
  }

  return c.json(
    { code: ERROR_CODES.INTERNAL_ERROR, message: "Internal server error" },
    500
  );
});
