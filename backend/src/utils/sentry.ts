// backend/src/utils/sentry.ts
// Единственная точка инициализации Sentry и вспомогательные хелперы захвата.
// Импорт модуля не имеет side-effect'ов: Sentry.init вызывается только через initSentry().
import * as Sentry from "@sentry/node";
import { env } from "../env.js";
import { logger } from "../logger.js";

const SENSITIVE_EXTRA_KEY_FRAGMENTS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "vk_sign",
  "sign",
];

export interface CaptureContext {
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

/**
 * Очистка события от PII перед отправкой в Sentry.
 * Убираем user, оставляем только url/method в request,
 * вырезаем чувствительные ключи из extra. Никогда не бросает.
 */
function stripPii(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  try {
    if (event.user) {
      event.user = {};
    }
    if (event.request) {
      event.request = {
        url: event.request.url,
        method: event.request.method,
      };
    }
    if (event.extra) {
      for (const key of Object.keys(event.extra)) {
        const lower = key.toLowerCase();
        if (SENSITIVE_EXTRA_KEY_FRAGMENTS.some((f) => lower.includes(f))) {
          delete event.extra[key];
        }
      }
    }
  } catch {
    // beforeSend не должен ронять отправку события
  }
  return event;
}

/** Инициализация Sentry. Без SENTRY_DSN — no-op (Sentry выключен). */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    logger.info("sentry_disabled_no_dsn");
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.APP_VERSION || "unknown",
    tracesSampleRate: env.isProduction ? 0.1 : 1.0,
    profilesSampleRate: env.isProduction ? 0.1 : 0,
    beforeSend: (event) => stripPii(event),
  });
}

/** Предупреждение в Sentry; без DSN — только лог уровня warn. */
export function captureWarning(
  message: string,
  context: CaptureContext = {}
): void {
  if (!env.SENTRY_DSN) {
    logger.warn({ message, extra: context.extra }, "sentry_warning_suppressed_no_dsn");
    return;
  }
  Sentry.captureMessage(message, { level: "warning", ...context });
}

/** Исключение в Sentry; без DSN — только лог уровня error. */
export function captureException(
  exception: unknown,
  context: CaptureContext = {}
): void {
  if (!env.SENTRY_DSN) {
    logger.error({ err: exception, extra: context.extra }, "sentry_exception_suppressed_no_dsn");
    return;
  }
  Sentry.captureException(exception, context);
}
