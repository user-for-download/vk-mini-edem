import React, { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWs } from "@/providers/WsProvider";
import { useWsEvent } from "@/providers/useWsEvent";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { TRIP_KEYS } from "@/queries/useTripsQuery";
import { buildWsEventKey, markSeenEvent } from "@/providers/wsEventDedup";

export const GlobalWsListener: React.FC = () => {
  const queryClient = useQueryClient();
  const { enqueue: enqueueSnackbar } = useSnackbar();
  const { resyncSeq } = useWs();
  const seenRef = useRef<Set<string>>(new Set());

  // Сервер после reconnect может повторно доставить события, которые
  // клиент уже учёл через resync fetch. Возвращает true для дубликатов —
  // обработчик должен пропустить их, чтобы не задвоить UI.
  const isDuplicate = useCallback((type: string, payload: unknown): boolean => {
    const { seen, duplicate } = markSeenEvent(seenRef.current, buildWsEventKey(type, payload));
    seenRef.current = seen;
    return duplicate;
  }, []);

  // Reconnect (WsProvider поднял resyncSeq): за время обрыва данные могли
  // устареть — обновляем всё, что зависит от WS-событий. Дедуп выше гасит
  // повторную доставку тех же событий сервером.
  useEffect(() => {
    if (resyncSeq === 0) return;
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.all });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
  }, [resyncSeq, queryClient]);

  useWsEvent("notification:new", () => {
    // Списка уведомлений в UI пока нет (notificationsApi не используется),
    // поэтому инвалидировать нечего. Обработчик оставлен как точка
    // подключения будущего экрана уведомлений.
  });

  useWsEvent("booking:new", ({ bookingId, tripId }) => {
    if (isDuplicate("booking:new", { bookingId, tripId })) return;
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
    // Новая бронь меняет seatsAvailable — обновляем и публичные списки.
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    enqueueSnackbar({
      type: "info",
      title: "Новая заявка на поездку",
      dedupeKey: `ws_booking_new_${bookingId}`,
    });
  });

  useWsEvent("booking:status_changed", ({ bookingId, tripId, status }) => {
    if (isDuplicate("booking:status_changed", { bookingId, tripId, status })) return;
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    // Подтверждение/отклонение брони меняет занятость мест в публичных списках.
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });

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
    if (isDuplicate("trip:status_changed", { tripId, status })) return;
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(tripId) });
    // Отменённая/завершённая поездка должна исчезнуть из публичного поиска.
    queryClient.invalidateQueries({ queryKey: TRIP_KEYS.lists() });

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
    if (isDuplicate("trip:details_changed", { tripId })) return;
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
