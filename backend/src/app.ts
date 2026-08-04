import { Hono } from "hono";
import { cors } from "hono/cors";

import { authRouter } from "./auth/index.js";
import { tripsRouter } from "./trips/index.js";
import { bookingsRouter } from "./bookings/index.js";
import { reviewsRouter } from "./reviews/index.js";
import { usersRouter } from "./users/index.js";

import { env } from "./env.js";
import { logger } from "./logger.js";
import { Sentry } from "./sentry.js";

export const app = new Hono();

const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return "";
      }

      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      return "";
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

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "edem-backend",
    time: new Date().toISOString(),
  });
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

  return c.json({ message: "Internal server error" }, 500);
});
