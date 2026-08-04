import * as Sentry from "@sentry/node";
import { env } from "./env.js";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.APP_VERSION || "unknown",
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,
    profilesSampleRate: env.isProduction ? 0.1 : 0,
  });
}

export { Sentry };
