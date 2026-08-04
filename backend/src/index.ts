import "./sentry.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

import { db } from "./db.js";
import { startTripWorker, stopTripWorker } from "./workers/tripWorker.js";

if (env.isProduction && env.ALLOW_DEV_AUTH) {
  throw new Error(
    "[FATAL] ALLOW_DEV_AUTH is enabled in production. This is a security risk."
  );
}

if (env.ALLOW_DEV_AUTH) {
  logger.warn(
    "DEV auth is enabled (mock tokens & dev-sign accepted). " +
    "Do NOT use in production."
  );
}

logger.info({ port: env.PORT }, "Starting Edem Backend");

const server = serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "0.0.0.0",
});

startTripWorker();

const SHUTDOWN_TIMEOUT_MS = 20_000;
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");
  stopTripWorker();
  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await db.$disconnect();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error({ err: error }, "Error closing database connections");
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "Forced shutdown after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
