import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { bodyLimit } from "hono/body-limit";
import { createNodeWebSocket } from "@hono/node-ws";
import fs from "node:fs";
import path from "node:path";

import { authRouter } from "./auth/index.js";
import { tripsRouter } from "./trips/index.js";
import { bookingsRouter } from "./bookings/index.js";
import { reviewsRouter } from "./reviews/index.js";
import { usersRouter } from "./users/index.js";
import { notificationsRouter } from "./notifications/index.js";
import { createWsHandler } from "./ws/index.js";

import { env } from "./env.js";
import { db } from "./db.js";
import { logger } from "./logger.js";
import { Sentry } from "./sentry.js";
import { ERROR_CODES } from "./errors.js";
import { httpRequestsTotal, metricsSnapshot } from "./metrics.js";

export const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
export { injectWebSocket };

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

  httpRequestsTotal.inc();

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
 *
 * ВАЖНО для VK Mini Apps: VK загружает мини-апп в iframe на vk.com / m.vk.com,
 * а на десктопе — через прокси akashi.vk-portal.net.
 * Поэтому вместо X-Frame-Options: DENY (который заблокировал бы загрузку)
 * используем CSP frame-ancestors, разрешающий только VK-домены, прокси и self.
 */
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://vk.com https://m.vk.com https://vk.ru https://m.vk.ru https://akashi.vk-portal.net"
  );
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
 * bodyLimit учитывает и chunked-запросы (Transfer-Encoding), в отличие от
 * проверки одного заголовка content-length.
 */
app.use(
  "*",
  bodyLimit({
    maxSize: 100 * 1024,
    onError: (c) =>
      c.json({ code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: "Payload too large" }, 413),
  })
);

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

/**
 * Метрики сервиса в Prometheus text-формате.
 */
app.get("/metrics", (c) => {
  return c.text(metricsSnapshot(), 200, { "Content-Type": "text/plain; charset=utf-8" });
});

app.route("/api/v1/auth", authRouter);
app.route("/api/v1/trips", tripsRouter);
app.route("/api/v1/bookings", bookingsRouter);
app.route("/api/v1/reviews", reviewsRouter);
app.route("/api/v1/notifications", notificationsRouter);
app.route("/api/v1/users", usersRouter);
app.get("/api/v1/ws", createWsHandler(upgradeWebSocket));

if (env.isProduction) {
  const distPath = path.resolve(process.cwd(), "mini-app/dist");

  // index.html читаем один раз при старте, а не на каждый SPA-запрос
  let indexHtml: string | null = null;
  try {
    indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf-8");
  } catch {
    logger.error("Frontend build (index.html) not found in production mode");
  }

  app.use("/*", serveStatic({ root: path.relative(process.cwd(), distPath) }));
  app.get("*", (c) => {
    if (indexHtml) {
      return c.html(indexHtml);
    }
    return c.text("Frontend build not found", 404);
  });
}

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
