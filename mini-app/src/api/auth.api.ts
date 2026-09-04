import { apiClient } from "./client";
import { authResponseSchema, type AuthRequest, type AuthResponse, type RefreshRequest } from "@edem/contracts";

export const authApi = {
  loginWithVk: (data: AuthRequest): Promise<AuthResponse> => {
    return apiClient.request<AuthResponse>("/auth/vk", {
      method: "POST",
      body: JSON.stringify(data),
    }, authResponseSchema);
  },

  refreshToken: (data: RefreshRequest): Promise<AuthResponse> => {
    return apiClient.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(data),
    }, authResponseSchema);
  },
};
