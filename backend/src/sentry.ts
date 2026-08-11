// backend/src/sentry.ts
// Re-export Sentry для обратной совместимости (app.ts использует { Sentry }).
// Инициализация — только через initSentry() из ./utils/sentry.js (вызывается в index.ts).
import * as Sentry from "@sentry/node";

export { Sentry };
