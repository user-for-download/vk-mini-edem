import { apiClient } from "./client";
import { authResponseSchema, type AuthResponse, type RefreshRequest, type TelegramAuthRequest } from "@edem/contracts";

export const authApi = {
  loginWithTelegram: (data: TelegramAuthRequest): Promise<AuthResponse> => {
    return apiClient.request<AuthResponse>("/auth/telegram", {
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
