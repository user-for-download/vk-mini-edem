// mini-app/src/queries/useTripsQuery.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { tripsApi, type SearchTripsFilters, type UpdateTripDto } from "../api/trips.api";
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

export function useInfiniteTripsQuery(filters?: SearchTripsFilters) {
  return useInfiniteQuery({
    queryKey: [...TRIP_KEYS.lists(), "infinite", filters],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tripsApi.getTrips({ ...filters, page: pageParam as number, limit: 20 });
      return { ...res, items: res.items as unknown as Trip[] };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    staleTime: 60_000,
  });
}

export function useUpdateTripMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTripDto }) =>
      tripsApi.updateTrip(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}

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
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMyTripsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: TRIP_KEYS.my(),
    queryFn: async () => {
      const res = await tripsApi.getMyTrips();
      return res.items as unknown as Trip[];
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useInfiniteMyTripsQuery(options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: [...TRIP_KEYS.my(), "infinite"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await tripsApi.getMyTrips({ page: pageParam as number, limit: 20 });
      return { ...res, items: res.items as unknown as Trip[] };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.page + 1 : undefined,
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
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
    placeholderData: keepPreviousData,
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
