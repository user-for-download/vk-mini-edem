import { apiGet, apiPost } from "@/lib/api-client";
import type { AdminLoginResponse, AdminSessionResponse } from "@edem/contracts";

/**
 * Вход по статичному ADMIN_TOKEN. Сессия устанавливается httpOnly cookie
 * edem_admin_jwt — клиент токен не хранит и не видит.
 */
export function adminLogin(
  token: string,
  signal?: AbortSignal
): Promise<AdminLoginResponse> {
  return apiPost<AdminLoginResponse>("/auth/login", { token }, signal);
}

/** Выход: бэкенд очищает cookie. Идемпотентно. */
export function adminLogout(signal?: AbortSignal): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>("/auth/logout", undefined, signal);
}

/**
 * Состояние сессии. Всегда 200 по контракту: httpOnly cookie недоступен JS,
 * поэтому фронт опрашивает этот ресурс для route-guard'а.
 */
export function getAdminSession(
  signal?: AbortSignal
): Promise<AdminSessionResponse> {
  return apiGet<AdminSessionResponse>("/auth/session", signal);
}
