import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWsEvent } from "@/providers/useWsEvent";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { TRIP_KEYS } from "@/queries/useTripsQuery";

export const GlobalWsListener: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueue: enqueueSnackbar } = useSnackbar();

  useWsEvent("notification:new", () => {
    // Списка уведомлений в UI пока нет (notificationsApi не используется),
    // поэтому инвалидировать нечего. Обработчик оставлен как точка
    // подключения будущего экрана уведомлений.
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
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });

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
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });

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

  useWsEvent("trip:details_changed", ({ tripId }) => {
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
    // Публичные списки (поиск/главная) тоже могут показывать изменённые
    // маршрут/цену/время — инвалидируем, чтобы не отдавать устаревшее.
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });

    enqueueSnackbar({
      type: "info",
      title: "Детали поездки изменены",
      subtitle: "Водитель внес изменения, проверьте информацию",
      dedupeKey: `ws_trip_changed_${tripId}`,
    });
  });

  return null;
};
