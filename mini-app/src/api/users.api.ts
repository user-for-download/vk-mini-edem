import { apiClient } from "./client";
import type { User } from "@/types";

export interface CarFormDto {
  model: string;
  color: string;
  plate: string;
}

export const usersApi = {
  getCurrentUser: (): Promise<User> => {
    return apiClient.request<User>("/users/me");
  },

  getUserById: (id: string): Promise<User> => {
    return apiClient.request<User>(`/users/${id}`);
  },

  updateProfile: (data: Partial<Pick<User, "name" | "about">>): Promise<User> => {
    return apiClient.request<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  updateCar: (data: CarFormDto): Promise<User> => {
    return apiClient.request<User>("/users/me/car", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
