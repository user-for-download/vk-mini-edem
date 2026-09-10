import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/users.api";
import type { CompleteOnboardingBody } from "@edem/contracts";

export const USER_KEYS = {
  all: ["users"] as const,
  current: () => [...USER_KEYS.all, "me"] as const,
  details: () => [...USER_KEYS.all, "detail"] as const,
  detail: (id: string) => [...USER_KEYS.details(), id] as const,
};

export function useCurrentUserQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: USER_KEYS.current(),
    queryFn: ({ signal }) => usersApi.getCurrentUser(signal),
    enabled: options?.enabled ?? true,
  });
}

export function useUserQuery(id: string) {
  return useQuery({
    queryKey: USER_KEYS.detail(id),
    queryFn: ({ signal }) => usersApi.getUserById(id, signal),
    enabled: Boolean(id),
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
}

export function useUpdateProfileMutation() {
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: (data: Parameters<typeof usersApi.updateProfile>[0]) =>
      usersApi.updateProfile(data),
    onSuccess: invalidateUsers,
  });
}

export function useUpdateCarMutation() {
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: (data: Parameters<typeof usersApi.updateCar>[0]) =>
      usersApi.updateCar(data),
    onSuccess: invalidateUsers,
  });
}

export function useCompleteOnboardingMutation() {
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ version }: CompleteOnboardingBody) =>
      usersApi.completeOnboarding(version),
    onSuccess: invalidateUsers,
  });
}

export function useUpdateNotificationSettingsMutation() {
  const invalidateUsers = useInvalidateUsers();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      usersApi.updateNotificationSettings(enabled),
    onSuccess: invalidateUsers,
  });
}

export function useDeleteCurrentUserMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.deleteCurrentUser(),
    onSuccess: () => queryClient.removeQueries({ queryKey: USER_KEYS.all }),
  });
}
