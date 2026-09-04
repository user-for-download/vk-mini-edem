import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { BanUserBody } from "@edem/contracts";

import { banUser, fetchUsers, resetOnboarding, unbanUser } from "./api";

const usersKey = (p: { q?: string; page: number; pageSize: number }) =>
  ["admin", "users", p] as const;

export function useUsersQuery(params: {
  q?: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: usersKey(params),
    queryFn: () => fetchUsers(params),
  });
}

export function useBanUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BanUserBody }) =>
      banUser(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Пользователь заблокирован");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useUnbanUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unbanUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Пользователь разблокирован");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}

export function useResetOnboardingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetOnboarding,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Онбординг сброшен");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
