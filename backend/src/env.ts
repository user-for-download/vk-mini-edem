// backend/src/env.ts
import dotenv from "dotenv";
import { randomBytes } from "node:crypto";

dotenv.config();

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

/**
 * В development можно временно сгенерировать эфемерный секрет,
 * чтобы не блокировать локальный запуск.
 *
 * В production секреты обязаны быть заданы явно.
 */
function secretEnv(name: string): string {
  const value = process.env[name];

  if (value) {
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
   * Dev-имитация разрешена только в development.
   *
   * По умолчанию в dev она включена, но ее можно выключить:
   * ALLOW_DEV_AUTH=false
   */
  ALLOW_DEV_AUTH: isProduction
    ? false
    : process.env.ALLOW_DEV_AUTH !== "false",

  /**
   * JWT TTL.
   */
  JWT_ACCESS_TTL_SECONDS: intEnv("JWT_ACCESS_TTL_SECONDS", 15 * 60),
  JWT_REFRESH_TTL_SECONDS: intEnv("JWT_REFRESH_TTL_SECONDS", 30 * 24 * 60 * 60),

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
