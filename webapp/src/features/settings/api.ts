import { apiGet } from "@/lib/api-client";
import { adminSettingsDtoSchema, type AdminSettingsDto } from "@edem/contracts";

/**
 * Read-only снимок rate-limit'ов и флагов из env
 * (GET /api/v1/admin/settings, backend/src/admin/index.ts).
 */
export function fetchSettings(): Promise<AdminSettingsDto> {
  return apiGet("/settings", adminSettingsDtoSchema);
}
