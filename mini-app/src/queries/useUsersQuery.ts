// mini-app/src/queries/useUsersQuery.ts
import { useQuery } from "@tanstack/react-query";
import { usersApi } from "../api/users.api";
import type { User } from "@/types";

export const USER_KEYS = {
  all: ["users"] as const,
  details: () => [...USER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: async () => {
      const res = await usersApi.getUserById(id);
      return res as unknown as User;
    },
    enabled: Boolean(id),
  });
}
