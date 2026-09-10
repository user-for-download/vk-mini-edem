import { useQuery } from "@tanstack/react-query";
import { citiesApi } from "@/api/cities.api";

export const CITY_KEYS = {
  all: ["cities"] as const,
  directory: () => [...CITY_KEYS.all, "all"] as const,
};

export function useAllCitiesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CITY_KEYS.directory(),
    queryFn: ({ signal }) => citiesApi.suggest("", signal),
    enabled: options?.enabled ?? true,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}
