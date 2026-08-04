import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

console.log(`Starting Edem Backend on port ${env.PORT}...`);

serve({
  fetch: app.fetch,
  port: env.PORT,
  hostname: "0.0.0.0",
});
