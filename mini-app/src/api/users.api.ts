import { apiClient } from "./client";
import { userSchema, type CompleteOnboardingBody } from "@edem/contracts";
import type { User } from "@/types";

export interface CarFormDto {
  model: string;
  color: string;
  plate: string;
}

export const usersApi = {
  getCurrentUser: (signal?: AbortSignal): Promise<User> => {
    return apiClient.request<User>("/users/me", { signal }, userSchema);
  },

  getUserById: (id: string, signal?: AbortSignal): Promise<User> => {
    return apiClient.request<User>(`/users/${encodeURIComponent(id)}`, { signal }, userSchema);
  },

  updateProfile: (data: Partial<Pick<User, "name" | "about">>): Promise<User> => {
    return apiClient.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }, userSchema);
  },

  updateCar: (data: CarFormDto): Promise<User> => {
    return apiClient.request<User>("/users/me/car", {
      method: "POST",
      body: JSON.stringify(data),
    }, userSchema);
  },

  // Завершение онбординга: сохраняет версию показанных слайдов
  // (POST /users/me/onboarding), возвращает обновлённого пользователя.
  completeOnboarding: (version: string): Promise<User> => {
    return apiClient.request<User>("/users/me/onboarding", {
      method: "POST",
      body: JSON.stringify({ version } satisfies CompleteOnboardingBody),
    }, userSchema);
  },

  updateNotificationSettings: (enabled: boolean): Promise<User> => {
    return apiClient.request<User>("/users/me/notification-settings", {
      method: "PATCH",
      body: JSON.stringify({ notificationsEnabled: enabled }),
    }, userSchema);
  },
};
