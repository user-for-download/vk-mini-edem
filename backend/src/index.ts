import "./sentry.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

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

serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "0.0.0.0",
});
