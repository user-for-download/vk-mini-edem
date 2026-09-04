// backend/tests/dev-mock-auth.ts
// Хелпер dev mock-токенов для интеграционных тестов (с high-fixes-01).
//
// Mock-токены принимаются сервером ТОЛЬКО для пользователей из явного
// allowlist (DEV_AUTH_USER_ALLOWLIST) и ТОЛЬКО пока не истёк TTL:
//
//   mock-access-token-<userId>-<expEpochSeconds>
//   mock-refresh-token-<userId>-<expEpochSeconds>
//
// Тесты создают пользователей динамически (свежие uuid), поэтому
// регистрируют их в allowlist во время выполнения — env.ts читает
// DEV_AUTH_USER_ALLOWLIST из process.env при каждом вызове (снапшота
// нет намеренно, см. devUserAllowlist в src/env.ts).
import { env } from "../src/env.js";

const MOCK_ACCESS_TOKEN_PREFIX = "mock-access-token-";
const MOCK_REFRESH_TOKEN_PREFIX = "mock-refresh-token-";

/**
 * Регистрирует пользователя в dev allowlist (идемпотентно).
 * Вызывается из devMockAccessToken/devMockRefreshToken автоматически.
 */
export function registerDevMockUser(userId: string): void {
  const raw = process.env.DEV_AUTH_USER_ALLOWLIST ?? "";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.includes(userId)) {
    list.push(userId);
    process.env.DEV_AUTH_USER_ALLOWLIST = list.join(",");
  }
}

/**
 * Валидный dev mock access-токен: allowlist-зарегистрированный пользователь
 * и exp = now + DEV_MOCK_TOKEN_TTL_SECONDS.
 */
export function devMockAccessToken(userId: string): string {
  registerDevMockUser(userId);
  const exp = Math.floor(Date.now() / 1000) + env.DEV_MOCK_TOKEN_TTL_SECONDS;
  return `${MOCK_ACCESS_TOKEN_PREFIX}${userId}-${exp}`;
}

/**
 * Валидный dev mock refresh-токен (формат как у access, другой префикс).
 */
export function devMockRefreshToken(userId: string): string {
  registerDevMockUser(userId);
  const exp = Math.floor(Date.now() / 1000) + env.DEV_MOCK_TOKEN_TTL_SECONDS;
  return `${MOCK_REFRESH_TOKEN_PREFIX}${userId}-${exp}`;
}
