import { apiGet, apiPost } from "@/lib/api-client";
import {
  adminLoginResponseSchema,
  adminSessionResponseSchema,
  type AdminLoginResponse,
  type AdminSessionResponse,
} from "@edem/contracts";
import { z } from "zod";

const okSchema = z.object({ ok: z.boolean() }).strict();

/**
 * Вход по статичному ADMIN_TOKEN. Сессия устанавливается httpOnly cookie
 * edem_admin_jwt — клиент токен не хранит и не видит.
 */
export function adminLogin(
  token: string,
  signal?: AbortSignal
): Promise<AdminLoginResponse> {
  return apiPost("/auth/login", { token }, adminLoginResponseSchema, signal);
}

/** Выход: бэкенд очищает cookie. Идемпотентно. */
export function adminLogout(signal?: AbortSignal): Promise<{ ok: boolean }> {
  return apiPost("/auth/logout", undefined, okSchema, signal);
}

/**
 * Состояние сессии. Всегда 200 по контракту: httpOnly cookie недоступен JS,
 * поэтому фронт опрашивает этот ресурс для route-guard'а.
 */
export function getAdminSession(
  signal?: AbortSignal
): Promise<AdminSessionResponse> {
  return apiGet("/auth/session", adminSessionResponseSchema, signal);
}
