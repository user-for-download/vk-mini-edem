// mini-app/src/queries/useBookingsQuery.ts
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { bookingsApi } from "../api/bookings.api";
import { TRIP_KEYS } from "./useTripsQuery";
import type {
  BookingStatus,
  CreateBookingDto,
} from "@edem/contracts";
import type { Booking } from "@/types";

export const BOOKING_KEYS = {
  all: ["bookings"] as const,
  my: () => [...BOOKING_KEYS.all, "my"] as const,
  history: () => [...BOOKING_KEYS.all, "history"] as const,
  trip: (tripId: string) => [...BOOKING_KEYS.all, "trip", tripId] as const,
};

export function useMyBookingsQuery() {
  return useQuery({
    queryKey: BOOKING_KEYS.my(),
    queryFn: async () => {
      const res = await bookingsApi.getUserBookings();
      return res as unknown as Booking[];
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * История поездок пассажира.
 */
export function usePassengerHistoryQuery() {
  return useMyBookingsQuery();
}

export function useTripBookingsQuery(tripId: string) {
  return useQuery({
    queryKey: BOOKING_KEYS.trip(tripId),
    queryFn: async () => {
      const res = await bookingsApi.getTripBookings(tripId);
      return res as unknown as Booking[];
    },
    enabled: Boolean(tripId),
    placeholderData: keepPreviousData,
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
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
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

