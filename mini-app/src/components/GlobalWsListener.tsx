import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWsEvent } from "@/providers/useWsEvent";
import { useSnackbarStore } from "@/store/useSnackbarStore";

export const GlobalWsListener: React.FC = () => {
  const queryClient = useQueryClient();
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);

  useWsEvent("notification:new", () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["users", "me"] });
  });

  useWsEvent("booking:new", ({ bookingId, tripId }) => {
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
    enqueueSnackbar({
      type: "info",
      title: "Новая заявка на поездку",
      dedupeKey: `ws_booking_new_${bookingId}`,
    });
  });

  useWsEvent("booking:status_changed", ({ bookingId, tripId, status }) => {
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });

    if (status === "confirmed") {
      enqueueSnackbar({
        type: "success",
        title: "Ваша заявка подтверждена!",
        dedupeKey: `ws_booking_confirmed_${bookingId}`,
      });
    } else if (status === "declined") {
      enqueueSnackbar({
        type: "error",
        title: "Ваша заявка отклонена",
        dedupeKey: `ws_booking_declined_${bookingId}`,
      });
    }
  });

  useWsEvent("trip:status_changed", ({ tripId, status }) => {
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });

    if (status === "cancelled") {
      enqueueSnackbar({
        type: "error",
        title: "Поездка отменена водителем",
        dedupeKey: `ws_trip_cancelled_${tripId}`,
      });
    } else if (status === "completed") {
      enqueueSnackbar({
        type: "info",
        title: "Поездка завершена",
        subtitle: "Вы можете оставить отзыв",
        dedupeKey: `ws_trip_completed_${tripId}`,
      });
    }
  });

  return null;
};
