import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateRideRequestDto, UpdateRideRequestDto } from "@edem/contracts";
import { rideRequestsApi } from "@/api/rideRequests.api";

export const RIDE_REQUEST_KEYS = {
  all: ["ride-requests"] as const,
};

export function useRideRequestsQuery(enabled = true) {
  return useQuery({
    queryKey: RIDE_REQUEST_KEYS.all,
    queryFn: ({ signal }) => rideRequestsApi.list(signal),
    enabled,
    staleTime: 30_000,
  });
}

function useRideRequestMutation<T>(mutationFn: (data: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RIDE_REQUEST_KEYS.all }),
  });
}

export function useCreateRideRequestMutation() {
  return useRideRequestMutation((data: CreateRideRequestDto) => rideRequestsApi.create(data));
}

export function useUpdateRideRequestMutation() {
  return useRideRequestMutation(({ id, data }: { id: string; data: UpdateRideRequestDto }) => rideRequestsApi.update(id, data));
}

export function useRideRequestStatusMutation() {
  return useRideRequestMutation(({ id, status }: { id: string; status: "active" | "paused" | "fulfilled" | "cancelled" }) => rideRequestsApi.setStatus(id, status));
}

export function useCancelRideRequestMutation() {
  return useRideRequestMutation((id: string) => rideRequestsApi.cancel(id));
}
