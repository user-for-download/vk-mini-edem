import { adminDashboardDtoSchema, type AdminDashboardDto } from "@edem/contracts";

import { apiGet } from "@/lib/api-client";

export function fetchDashboard(): Promise<AdminDashboardDto> {
  return apiGet("/dashboard", adminDashboardDtoSchema);
}
