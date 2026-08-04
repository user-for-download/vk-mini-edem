import { apiClient } from "./client";
import type { AuthRequest, AuthResponse, RefreshRequest } from "@edem/contracts";

export const authApi = {
  loginWithVk: (data: AuthRequest): Promise<AuthResponse> => {
    return apiClient.request<AuthResponse>("/auth/vk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  refreshToken: (data: RefreshRequest): Promise<AuthResponse> => {
    return apiClient.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
