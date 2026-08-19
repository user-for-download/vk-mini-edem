// mini-app/src/queries/useBookingsQuery.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  keepPreviousData,
} from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings.api";
import { TRIP_KEYS } from "./useTripsQuery";
import type {
  CreateBookingDto,
  DriverBookingAction,
} from "@edem/contracts";

export const BOOKING_KEYS = {
  all: ["bookings"] as const,
  my: () => [...BOOKING_KEYS.all, "my"] as const,
  history: () => [...BOOKING_KEYS.all, "history"] as const,
  trip: (tripId: string) => [...BOOKING_KEYS.all, "trip", tripId] as const,
};

export function useMyBookingsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: BOOKING_KEYS.my(),
    queryFn: async ({ signal }) => {
      // getUserBookings уже типизирован как PassengerBooking[] (поле scope
      // нужно для разделения активных/истории на главной).
      return bookingsApi.getUserBookings(signal);
    },
    enabled: options?.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

/**
 * История поездок пассажира.
 */
export function usePassengerHistoryQuery() {
  return useQuery({
    queryKey: BOOKING_KEYS.history(),
    queryFn: ({ signal }) => bookingsApi.getHistory(signal),
    placeholderData: keepPreviousData,
  });
}

export function useTripBookingsQuery(tripId: string, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: BOOKING_KEYS.trip(tripId),
    queryFn: async ({ pageParam, signal }) => {
      return bookingsApi.getTripBookings(tripId, pageParam, 50, signal);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined,
    enabled: Boolean(tripId) && (options?.enabled ?? true),
  });
}

export function useCreateBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBookingDto) => bookingsApi.createBooking(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}

export function useUpdateBookingStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DriverBookingAction }) =>
      bookingsApi.updateBookingStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}

/**
 * Отмена брони пассажиром.
 */
export function useCancelBookingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (bookingId: string) => bookingsApi.cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.my() });
      queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    },
  });
}
