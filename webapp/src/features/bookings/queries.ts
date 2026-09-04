import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminBookingStatusBody } from "@edem/contracts";
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success("Статус брони обновлён");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
