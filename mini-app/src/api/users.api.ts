import { apiClient } from "./client";
import type { User } from "@edem/contracts";

export const usersApi = {
  getCurrentUser: (): Promise<User> => {
    return apiClient.request<User>("/users/me");
  },

  getUserById: (id: string): Promise<User> => {
    return apiClient.request<User>(`/users/${id}`);
  },

  updateProfile: (data: Partial<User>): Promise<User> => {
    return apiClient.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
