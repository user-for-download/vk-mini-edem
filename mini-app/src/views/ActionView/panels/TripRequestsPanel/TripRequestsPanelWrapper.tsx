// mini-app/src/views/ActionView/panels/TripRequestsPanel/TripRequestsPanelWrapper.tsx
import { type FC } from "react";
import { useParams, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { TripRequestsPanel } from "@/views/ActionView/panels/TripRequestsPanel/TripRequestsPanel";
import { useTripDetailQuery } from "@/queries/useTripsQuery";
import {
  useTripBookingsQuery,
  useUpdateBookingStatusMutation,
} from "@/queries/useBookingsQuery";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import type { BookingStatus } from "@/types";

export const TripRequestsPanelWrapper: FC<{ id: string }> = ({ id }) => {
  const params = useParams<"tripId">();
  const routeNavigator = useRouteNavigator();

  const tripId = params?.tripId;

  const { data: trip } = useTripDetailQuery(tripId ?? "");
  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
  } = useTripBookingsQuery(tripId ?? "");

  const updateBooking = useUpdateBookingStatusMutation();
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  const handleSetStatus = (bookingId: string, status: BookingStatus) => {
    updateBooking.mutate(
      { id: bookingId, status },
      {
        onSuccess: () => {
          enqueueSnackbar({
            type: status === "confirmed" ? "success" : "info",
            title:
              status === "confirmed"
                ? "Заявка подтверждена"
                : "Заявка отклонена",
            dedupeKey: `booking_status_${bookingId}_${status}`,
          });
        },
        onError: (error) => {
          enqueueSnackbar({
            type: "error",
            title: "Не удалось обновить заявку",
            subtitle: error instanceof Error ? error.message : undefined,
            dedupeKey: `booking_status_error_${bookingId}`,
          });
        },
      }
    );
  };

  return (
    <TripRequestsPanel
      id={id}
      trip={trip ?? null}
      bookings={bookings ?? []}
      isLoading={isLoading}
      isError={isError}
      onBack={() => routeNavigator.push("/trips/my")}
      onSetStatus={handleSetStatus}
      onRetry={() => refetch()}
    />
  );
};
