import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cancelTrip, fetchTrips, type TripStatus } from "./api";

export interface TripsQueryParams {
  status?: TripStatus;
  page: number;
  pageSize: number;
}

const tripsKey = (p: TripsQueryParams) => ["admin", "trips", p] as const;

export function useTripsQuery(params: TripsQueryParams) {
  return useQuery({
    queryKey: tripsKey(params),
    queryFn: () => fetchTrips(params),
  });
}

export function useCancelTripMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelTrip(id),
    onSuccess: () => {
      // Статус поездки влияет и на метрики дашборда — инвалидируем оба кэша.
      void queryClient.invalidateQueries({ queryKey: ["admin", "trips"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      toast.success("Поездка отменена");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Не удалось отменить поездку"
      );
    },
  });
}
