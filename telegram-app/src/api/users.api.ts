import { z } from "zod";
import {
  userSchema,
  type CompleteOnboardingBody,
  type User,
} from "@edem/contracts";
import { apiClient } from "./client";

const successSchema = z.object({ success: z.boolean() }).strict();

export interface CarFormDto {
  model: string;
  color: string;
  plate?: string;
}

export const usersApi = {
  getCurrentUser: (signal?: AbortSignal): Promise<User> =>
    apiClient.request("/users/me", { signal }, userSchema),

  getUserById: (id: string, signal?: AbortSignal): Promise<User> =>
    apiClient.request(
      `/users/${encodeURIComponent(id)}`,
      { signal },
      userSchema,
    ),

  updateProfile: (data: Partial<Pick<User, "name" | "about">>): Promise<User> =>
    apiClient.request(
      "/users/me",
      { method: "PATCH", body: JSON.stringify(data) },
      userSchema,
    ),

  updateCar: (data: CarFormDto): Promise<User> =>
    apiClient.request(
      "/users/me/car",
      { method: "POST", body: JSON.stringify(data) },
      userSchema,
    ),

  completeOnboarding: (version: string): Promise<User> =>
    apiClient.request(
      "/users/me/onboarding",
      {
        method: "POST",
        body: JSON.stringify({ version } satisfies CompleteOnboardingBody),
      },
      userSchema,
    ),

  updateNotificationSettings: (enabled: boolean): Promise<User> =>
    apiClient.request(
      "/users/me/notification-settings",
      {
        method: "PATCH",
        body: JSON.stringify({ notificationsEnabled: enabled }),
      },
      userSchema,
    ),

  deleteCurrentUser: (): Promise<{ success: boolean }> =>
    apiClient.request("/users/me", { method: "DELETE" }, successSchema),
};
