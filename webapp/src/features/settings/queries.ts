import { useQuery } from "@tanstack/react-query";

import { fetchSettings } from "./api";

const ADMIN_SETTINGS_KEY = ["admin", "settings"] as const;

export function useSettingsQuery() {
  return useQuery({
    queryKey: ADMIN_SETTINGS_KEY,
    queryFn: fetchSettings,
  });
}
