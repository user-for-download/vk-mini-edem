// mini-app/src/queries/useUsersQuery.ts
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../api/users.api";

export const USER_KEYS = {
  all: ["users"] as const,
  details: () => [...USER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: ({ signal }) => usersApi.getUserById(id, signal),
    enabled: Boolean(id),
  });
}
