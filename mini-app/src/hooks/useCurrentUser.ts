// mini-app/src/hooks/useCurrentUser.ts
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types";

/**
 * Возвращает авторизованного пользователя.
 *
 * Если пользователь ещё не загружен, возвращает мок-пользователя,
 * чтобы компоненты не падали.
 */
export function useCurrentUser(): User {
  const user = useAuthStore((state) => state.user);

  if (user) {
    return user;
  }

  // Fallback для dev-режима и состояния до авторизации
  return {
    id: "u-placeholder",
    name: "Пользователь",
    avatar: "https://i.pravatar.cc/200?u=placeholder",
    rating: 5.0,
    reviewsCount: 0,
    tripsCount: 0,
    isVerified: false,
  };
}
