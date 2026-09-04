import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminBookingDto,
  AdminBookingStatusBody,
  AdminPaginatedBookings,
} from "@edem/contracts";
import { toast } from "sonner";

import {
  fetchBookings,
  updateBookingStatus,
  type FetchBookingsParams,
} from "./api";

const bookingsKey = (params: FetchBookingsParams) =>
  ["admin", "bookings", params] as const;

export function useBookingsQuery(params: FetchBookingsParams) {
  return useQuery({
    queryKey: bookingsKey(params),
    queryFn: () => fetchBookings(params),
  });
}

export interface BookingStatusMutationVars {
  id: string;
  body: AdminBookingStatusBody;
}

export function useBookingStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: BookingStatusMutationVars) =>
      updateBookingStatus(id, body),
    // Optimistic update: render the new status instantly, roll back on failure.
    onMutate: ({ id, body }: BookingStatusMutationVars) => {
      const previous = queryClient.getQueriesData<AdminPaginatedBookings>({
        queryKey: ["admin", "bookings"],
      });
      queryClient.setQueriesData<AdminPaginatedBookings>(
        { queryKey: ["admin", "bookings"] },
        (cached) => {
          if (!cached) return cached;
          const items: AdminBookingDto[] = cached.items.map((booking) =>
            booking.id === id ? { ...booking, status: body.status } : booking,
          );
          return { ...cached, items };
        },
      );
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      // Roll back to the snapshot taken in onMutate so state stays consistent.
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Статус брони обновлён");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}
