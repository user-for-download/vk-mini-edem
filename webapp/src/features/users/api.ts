import { apiGet, apiPatch } from "@/lib/api-client";
import {
  adminPaginatedUsersSchema,
  adminUserDtoSchema,
  type AdminUsersQuery,
} from "@edem/contracts";
import type { AdminPaginatedUsers, AdminUserDto, BanUserBody } from "@edem/contracts";

/**
 * GET /api/v1/admin/users?q=&page=&pageSize=
 * Пустой q не отправляем — бэкенд трактует его как отсутствие фильтра.
 */
export function fetchUsers(params: AdminUsersQuery): Promise<AdminPaginatedUsers> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.q) {
    search.set("q", params.q);
  }
  return apiGet("/users?" + search.toString(), adminPaginatedUsersSchema);
}

/**
 * PATCH /api/v1/admin/users/:id/ban — идемпотентный бан: сохраняет bannedAt и
 * обязательную причину (1–500 символов после trim). Контракт валидируется
 * сервером через banUserBodySchema.
 */
export function banUser(id: string, body: BanUserBody): Promise<AdminUserDto> {
  return apiPatch(`/users/${encodeURIComponent(id)}/ban`, body, adminUserDtoSchema);
}

/** PATCH /api/v1/admin/users/:id/unban — очищает bannedAt и banReason. */
export function unbanUser(id: string): Promise<AdminUserDto> {
  return apiPatch(`/users/${encodeURIComponent(id)}/unban`, undefined, adminUserDtoSchema);
}

/** PATCH /api/v1/admin/users/:id/onboarding-reset — обнуляет onboardingVersion. */
export function resetOnboarding(id: string): Promise<AdminUserDto> {
  return apiPatch(`/users/${encodeURIComponent(id)}/onboarding-reset`, undefined, adminUserDtoSchema);
}
