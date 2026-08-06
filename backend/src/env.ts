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

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
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
    ? intEnv("PORT", 3000)
    : intEnv("BACKEND_PORT", 3001),

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
  JWT_ACCESS_TTL_SECONDS: intEnv("JWT_ACCESS_TTL_SECONDS", 15 * 60),
  JWT_REFRESH_TTL_SECONDS: intEnv("JWT_REFRESH_TTL_SECONDS", 30 * 24 * 60 * 60),

  /**
   * Если приложение стоит за доверенным прокси (Nginx), прокси
   * перезаписывает X-Real-IP / X-Forwarded-For, и им можно доверять.
   * Иначе используем IP из TCP-сокета (неподделываемый).
   */
  TRUST_PROXY: boolEnv("TRUST_PROXY", false),

  /**
   * Rate limit для auth.
   */
  AUTH_RATE_WINDOW_MS: intEnv("AUTH_RATE_WINDOW_MS", 15 * 60 * 1000),
  AUTH_RATE_MAX: intEnv("AUTH_RATE_MAX", 20),

  LOG_LEVEL:
    process.env.LOG_LEVEL ||
    (isProduction ? "info" : "debug"),

  SENTRY_DSN: process.env.SENTRY_DSN || "",
};
