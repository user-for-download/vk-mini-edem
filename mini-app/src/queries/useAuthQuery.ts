import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { apiClient } from "../api/client";
import type { AuthRequest } from "@edem/contracts";

export function useLoginMutation() {
  return useMutation({
    mutationFn: (data: AuthRequest) => authApi.loginWithVk(data),
    onSuccess: (data) => {
      apiClient.setToken(data.accessToken);
    },
  });
}
