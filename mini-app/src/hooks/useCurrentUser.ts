// mini-app/src/hooks/useCurrentUser.ts
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types";

/**
 * Возвращает авторизованного пользователя.
 */
export function useCurrentUser(): User | null {
  return useAuthStore((state) => state.user);
}
