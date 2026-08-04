import "./sentry.js";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

logger.info({ port: env.PORT }, "Starting Edem Backend");

serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "0.0.0.0",
});
