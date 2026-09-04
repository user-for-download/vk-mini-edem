// backend/src/env.ts
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Поиск .env: для запуска из src (tsx) и из dist (скопилированный JS)
const envPathDev = path.resolve(__dirname, "../.env");
const envPathProd = path.resolve(__dirname, "../../.env");
dotenv.config({ path: fs.existsSync(envPathDev) ? envPathDev : envPathProd });

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProduction = NODE_ENV === "production";

function failMissingEnv(name: string): never {
  throw new Error(`[env] Missing required environment variable: ${name}`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    failMissingEnv(name);
  }

  return value;
}

export function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`[env] ${name} must be a positive integer.`);
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`[env] ${name} must be a positive integer.`);
  }

  return parsed;
}

function optionalPositiveIntEnv(name: string): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return 0;
  return positiveIntEnv(name, 0);
}

/**
 * Явный allowlist пользователей, которым разрешены dev mock-токены
 * (DEV_AUTH_USER_ALLOWLIST: comma-separated user id).
 *
 * Читаем из process.env при КАЖДОМ вызове, а не снапшотим в env-объект:
 * интеграционные тесты создают пользователей динамически и регистрируют
 * их в allowlist во время выполнения. Функция вызывается только в ветке
 * ALLOW_DEV_AUTH (dev/test) — в production ALLOW_DEV_AUTH всегда false,
 * mock-токены сюда не доходят.
 */
export function devUserAllowlist(): ReadonlySet<string> {
  const raw = process.env.DEV_AUTH_USER_ALLOWLIST;
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

function boolEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

/**
 * В development можно временно сгенерировать эфемерный секрет,
 * чтобы не блокировать локальный запуск.
 *
 * В production секреты обязаны быть заданы явно.
 */
function secretEnv(name: string): string {
  const value = process.env[name];

  if (value) {
    if (isProduction && name === "JWT_SECRET" && value.length < 32) {
      throw new Error(
        `[env] ${name} must be at least 32 characters long in production.`
      );
    }
    return value;
  }

  if (isProduction) {
    failMissingEnv(name);
  }

  console.warn(
    `[env] ${name} is not set. Generated ephemeral development secret. ` +
      `Do not use this in production.`
  );

  return randomBytes(32).toString("hex");
}

export const env = {
  NODE_ENV,
  isProduction,

  PORT: isProduction
    ? positiveIntEnv("PORT", 3000)
    : positiveIntEnv("BACKEND_PORT", 3001),

  /**
   * DATABASE_URL обязателен всегда.
   * Никакого fallback быть не должно.
   */
  DATABASE_URL: requiredEnv("DATABASE_URL"),

  /**
   * Секреты.
   * В production обязательны.
   * В development могут быть эфемерными, если не заданы.
   */
  JWT_SECRET: secretEnv("JWT_SECRET"),
  VK_APP_SECRET: secretEnv("VK_APP_SECRET"),

  /**
   * Интеграция с VK API для отправки сообщений пользователям
   * (messages.send от имени сообщества). Опциональна: если не задана —
   * сообщения не отправляются, приложение продолжает работать.
   */
  VK_GROUP_ID: optionalPositiveIntEnv("VK_GROUP_ID"),
  VK_GROUP_TOKEN: process.env.VK_GROUP_TOKEN || "",

  /**
   * Сервисный ключ доступа мини-аппа для отправки push-уведомлений
   * через VK API notifications.sendMessage (см. services/vkPush.ts).
   * Опционален: если не задан — push не отправляются, приложение
   * продолжает работать. Секрет: не логировать, не коммитить.
   */
  VK_SERVICE_KEY: process.env.VK_SERVICE_KEY || "",

  /**
   * CORS.
   * В production список origin обязателен.
   */
  CORS_ORIGINS: isProduction
    ? requiredEnv("CORS_ORIGINS")
    : process.env.CORS_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001",

  /**
   * Dev-имитация разрешена только в development/test (если ALLOW_DEV_AUTH=true).
   * В production всегда false.
   */
  ALLOW_DEV_AUTH: (() => {
    if (isProduction) return false;
    if (process.env.VITEST) return true;
    return process.env.ALLOW_DEV_AUTH === "true";
  })(),

  /**
   * JWT TTL.
   */
  JWT_ACCESS_TTL_SECONDS: positiveIntEnv("JWT_ACCESS_TTL_SECONDS", 15 * 60),
  JWT_REFRESH_TTL_SECONDS: positiveIntEnv("JWT_REFRESH_TTL_SECONDS", 30 * 24 * 60 * 60),

  /**
   * TTL dev mock-токенов (mock-access-token-<id>, mock-refresh-token-<id>) в секундах.
   * Короткий намеренно: mock-токен — одноразовый dev-артефакт, а не сессия.
   */
  DEV_MOCK_TOKEN_TTL_SECONDS: positiveIntEnv("DEV_MOCK_TOKEN_TTL_SECONDS", 15 * 60),

  /**
   * Если приложение стоит за доверенным прокси (Nginx), прокси
   * перезаписывает X-Real-IP / X-Forwarded-For, и им можно доверять.
   * Иначе используем IP из TCP-сокета (неподделываемый).
   */
  TRUST_PROXY: boolEnv("TRUST_PROXY", false),

  /**
   * Rate limit для auth (раздельные лимитеры на каждый endpoint).
   */
  VK_AUTH_RATE_WINDOW_MS: positiveIntEnv("VK_AUTH_RATE_WINDOW_MS", 5 * 60 * 1000),
  VK_AUTH_RATE_MAX: positiveIntEnv("VK_AUTH_RATE_MAX", 5),
  REFRESH_RATE_WINDOW_MS: positiveIntEnv("REFRESH_RATE_WINDOW_MS", 10 * 60 * 1000),
  REFRESH_RATE_MAX: positiveIntEnv("REFRESH_RATE_MAX", 10),

  /**
   * Rate limits (IP-based).
   */
  PUBLIC_READ_RATE_WINDOW_MS: positiveIntEnv("PUBLIC_READ_RATE_WINDOW_MS", 60 * 1000),
  PUBLIC_READ_RATE_MAX: positiveIntEnv("PUBLIC_READ_RATE_MAX", 100),
  MUTATION_RATE_WINDOW_MS: positiveIntEnv("MUTATION_RATE_WINDOW_MS", 60 * 1000),
  MUTATION_RATE_MAX: positiveIntEnv("MUTATION_RATE_MAX", 30),

  /**
   * Rate limits (user-based): «дорогие» действия по аккаунту.
   */
  CREATE_TRIP_RATE_WINDOW_MS: positiveIntEnv("CREATE_TRIP_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  CREATE_TRIP_RATE_MAX: positiveIntEnv("CREATE_TRIP_RATE_MAX", 10),
  CANCEL_TRIP_RATE_WINDOW_MS: positiveIntEnv("CANCEL_TRIP_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  CANCEL_TRIP_RATE_MAX: positiveIntEnv("CANCEL_TRIP_RATE_MAX", 20),
  CREATE_BOOKING_RATE_WINDOW_MS: positiveIntEnv("CREATE_BOOKING_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  CREATE_BOOKING_RATE_MAX: positiveIntEnv("CREATE_BOOKING_RATE_MAX", 20),
  CANCEL_BOOKING_RATE_WINDOW_MS: positiveIntEnv("CANCEL_BOOKING_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  CANCEL_BOOKING_RATE_MAX: positiveIntEnv("CANCEL_BOOKING_RATE_MAX", 20),
  /** Завершение поездок водителем (PATCH /trips/:id/complete), 20 в сутки. */
  COMPLETE_TRIP_RATE_WINDOW_MS: positiveIntEnv("COMPLETE_TRIP_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  COMPLETE_TRIP_RATE_MAX: positiveIntEnv("COMPLETE_TRIP_RATE_MAX", 20),

  /**
   * Rate limits (user-based): частые, но лёгкие действия по аккаунту
   * (профиль, машина, уведомления, личные списки). Окно — сутки.
   */
  PROFILE_UPDATE_RATE_WINDOW_MS: positiveIntEnv("PROFILE_UPDATE_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  PROFILE_UPDATE_RATE_MAX: positiveIntEnv("PROFILE_UPDATE_RATE_MAX", 50),
  NOTIFICATION_READ_RATE_WINDOW_MS: positiveIntEnv("NOTIFICATION_READ_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  NOTIFICATION_READ_RATE_MAX: positiveIntEnv("NOTIFICATION_READ_RATE_MAX", 100),
  REVIEWS_READ_RATE_WINDOW_MS: positiveIntEnv("REVIEWS_READ_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  REVIEWS_READ_RATE_MAX: positiveIntEnv("REVIEWS_READ_RATE_MAX", 100),
  FEEDBACK_READ_RATE_WINDOW_MS: positiveIntEnv("FEEDBACK_READ_RATE_WINDOW_MS", 24 * 60 * 60 * 1000),
  FEEDBACK_READ_RATE_MAX: positiveIntEnv("FEEDBACK_READ_RATE_MAX", 100),

  LOG_LEVEL:
    process.env.LOG_LEVEL ||
    (isProduction ? "info" : "debug"),

  SENTRY_DSN: process.env.SENTRY_DSN || "",

  /**
   * Bearer-токен для служебного endpoint /metrics.
   * В production отсутствие токена не открывает endpoint публично.
   */
  METRICS_TOKEN: process.env.METRICS_TOKEN || "",

  /**
   * Статичный токен админ-панели (тело POST /api/v1/admin/auth/login).
   * Пустое значение = админ-API выключено: все запросы получают 403.
   * Намеренно НЕ secretEnv: эфемерный dev-секрет недопустим,
   * панель закрыта по умолчанию в любой среде, пока токен не задан.
   */
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || "",

  /**
   * TTL JWT админ-панели (httpOnly cookie edem_admin_jwt).
   * По умолчанию 12 часов; refresh-токенов нет — по истечении повторный логин.
   */
  ADMIN_JWT_TTL_SECONDS: positiveIntEnv("ADMIN_JWT_TTL_SECONDS", 12 * 60 * 60),

  /**
   * Rate limit логина админ-панели (IP-based, анти-брутфорс).
   */
  ADMIN_LOGIN_RATE_WINDOW_MS: positiveIntEnv(
    "ADMIN_LOGIN_RATE_WINDOW_MS",
    5 * 60 * 1000
  ),
  ADMIN_LOGIN_RATE_MAX: positiveIntEnv("ADMIN_LOGIN_RATE_MAX", 5),

  /**
   * Rate limit GET-эндпоинтов админ-панели (IP-based).
   * Выше публичного read-лимитера: UI админки отдаёт запросами пачками
   * (дашборд + списки + пагинация).
   */
  ADMIN_READ_RATE_WINDOW_MS: positiveIntEnv("ADMIN_READ_RATE_WINDOW_MS", 60 * 1000),
  ADMIN_READ_RATE_MAX: positiveIntEnv("ADMIN_READ_RATE_MAX", 300),
};
