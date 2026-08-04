// mini-app/src/queries/useTripsQuery.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripsApi, type SearchTripsFilters } from "../api/trips.api";
import type { CreateTripDto } from "@edem/contracts";
import type { Trip } from "@/types";

export const TRIP_KEYS = {
  all: ["trips"] as const,
  lists: () => [...TRIP_KEYS.all, "list"] as const,
  list: (filters?: SearchTripsFilters) => [...TRIP_KEYS.lists(), filters] as const,
  my: () => [...TRIP_KEYS.all, "my"] as const,
  details: () => [...TRIP_KEYS.all, "detail"] as const,
  detail: (id: string) => [...TRIP_KEYS.details(), id] as const,
};

export function useTripsQuery(filters?: SearchTripsFilters) {
  return useQuery({
    queryKey: TRIP_KEYS.list(filters),
    queryFn: async () => {
      const res = await tripsApi.getTrips(filters);
      return {
        ...res,
        items: res.items as unknown as Trip[],
      };
    },
    staleTime: 30_000,
  });
}

export function useMyTripsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: TRIP_KEYS.my(),
    queryFn: async () => {
      const res = await tripsApi.getMyTrips();
      return res as unknown as Trip[];
    },
    enabled: options?.enabled ?? true,
  });
}

export function useTripDetailQuery(id: string) {
  return useQuery({
    queryKey: TRIP_KEYS.detail(id),
    queryFn: async () => {
      const res = await tripsApi.getTripById(id);
      return res as unknown as Trip;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTripMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTripDto) => tripsApi.createTrip(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}

export function useCancelTripMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tripsApi.cancelTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}

/**
 * Завершение поездки водителем.
 */
export function useCompleteTripMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tripsApi.completeTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });

      // После завершения поездки меняются статусы pending-броней,
      // поэтому инвалидируем и брони.
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
}
