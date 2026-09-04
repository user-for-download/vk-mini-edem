import { useQuery } from "@tanstack/react-query";

import { fetchDashboard } from "./api";

export const ADMIN_DASHBOARD_KEY = ["admin", "dashboard"] as const;

export function useDashboardQuery() {
  return useQuery({
    queryKey: ADMIN_DASHBOARD_KEY,
    queryFn: fetchDashboard,
  });
}
