import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { TRIP_KEYS, BOOKING_KEYS } from "@/queries";
import type { WsEvent } from "@edem/contracts";

const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

function getWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL;
  if (explicit) return explicit;

  const apiBase = import.meta.env.VITE_API_URL || "";
  if (apiBase.startsWith("http")) {
    return apiBase.replace(/^http/, "ws").replace(/\/api\/?$/, "") + "/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function useWebSocket(): void {
  const queryClient = useQueryClient();
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.session?.accessToken);
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);
  const { isOnline } = useOnlineStatus();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCancelledRef = useRef(false);

  const handleWsEvent = useCallback(
    (msg: WsEvent) => {
      switch (msg.event) {
        case "booking_created":
          queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.trip(msg.tripId) });
          queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
          enqueueSnackbar({
            type: "info",
            title: "Новая заявка на поездку",
            dedupeKey: `ws_booking_created_${msg.bookingId}`,
          });
          break;

        case "booking_status_changed":
          queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(msg.tripId) });
          queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.my() });
          if (msg.status === "confirmed") {
            enqueueSnackbar({
              type: "success",
              title: "Ваша заявка подтверждена!",
              dedupeKey: `ws_booking_confirmed_${msg.bookingId}`,
            });
          } else if (msg.status === "declined") {
            enqueueSnackbar({
              type: "error",
              title: "Ваша заявка отклонена",
              dedupeKey: `ws_booking_declined_${msg.bookingId}`,
            });
          }
          break;

        case "booking_cancelled":
          queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.trip(msg.tripId) });
          queryClient.invalidateQueries({ queryKey: TRIP_KEYS.my() });
          break;

        case "trip_status_changed":
          queryClient.invalidateQueries({ queryKey: TRIP_KEYS.detail(msg.tripId) });
          queryClient.invalidateQueries({ queryKey: BOOKING_KEYS.my() });
          if (msg.status === "cancelled") {
            enqueueSnackbar({
              type: "error",
              title: "Поездка отменена водителем",
              dedupeKey: `ws_trip_cancelled_${msg.tripId}`,
            });
          } else if (msg.status === "completed") {
            enqueueSnackbar({
              type: "info",
              title: "Поездка завершена",
              subtitle: "Вы можете оставить отзыв",
              dedupeKey: `ws_trip_completed_${msg.tripId}`,
            });
          }
          break;
      }
    },
    [queryClient, enqueueSnackbar]
  );

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !isOnline) return;

    isCancelledRef.current = false;
    const wsUrl = getWsUrl();

    const connect = () => {
      if (isCancelledRef.current) return;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        ws.send(JSON.stringify({ type: "auth", token: accessToken }));
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }
          if (msg.event) {
            handleWsEvent(msg as WsEvent);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (isCancelledRef.current) return;
        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts.current,
          MAX_RECONNECT_DELAY_MS
        );
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      isCancelledRef.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [status, accessToken, isOnline, handleWsEvent]);
}
