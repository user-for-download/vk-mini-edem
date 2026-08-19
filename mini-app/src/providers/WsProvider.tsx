import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { apiClient } from "../api/client";
import { wsServerEventSchema, type WsClientEvent, type WsServerEvent } from "@edem/contracts";
import { useAuthStore } from "../store/useAuthStore";

interface WsContextValue {
  isConnected: boolean;
  send: (event: WsClientEvent) => void;
  lastMessage: WsServerEvent | null;
}

const WsContext = createContext<WsContextValue | null>(null);

export const useWs = () => {
  const context = useContext(WsContext);
  if (!context) {
    throw new Error("useWs must be used within WsProvider");
  }
  return context;
};

function getWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || "/api/v1";
  if (apiUrl.startsWith("http")) {
    return apiUrl.replace(/^http/, "ws") + "/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${apiUrl}/ws`;
}

const WS_RECONNECT_BASE_DELAY_MS = 1_000;
const WS_RECONNECT_MAX_DELAY_MS = 30_000;

export const WsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsServerEvent | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const disposedRef = useRef(false);
  const accessToken = useAuthStore((state) => state.session?.accessToken ?? null);

  // connect вызывается сам из себя (reconnect в onclose), а самоссылка
  // в инициализаторе useCallback запрещена (react-hooks/immutability).
  // Храним актуальную ссылку в рефе — identity connect стабильна (deps []),
  // поэтому эффект ниже отрабатывает один раз.
  const connectRef = useRef<() => void>(() => {});

  const scheduleReconnectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    if (
      disposedRef.current ||
      reconnectTimeoutRef.current ||
      !navigator.onLine ||
      document.visibilityState === "hidden"
    ) {
      return;
    }

    const attempt = reconnectAttemptRef.current++;
    const baseDelay = Math.min(
      WS_RECONNECT_BASE_DELAY_MS * 2 ** attempt,
      WS_RECONNECT_MAX_DELAY_MS,
    );
    const delay = Math.round(baseDelay * (0.75 + Math.random() * 0.5));

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;
      if (!disposedRef.current) connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    if (disposedRef.current) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return;
    // Если идёт refresh (из HTTP-клиента или WsProvider) — не пытаемся
    // переподключиться: после завершения нас разбудит onTokenUpdate.
    if (apiClient.isRefreshing()) return;

    const token = useAuthStore.getState().session?.accessToken;
    if (!token) return; // Wait until token is available

    // Токен передаём только в auth-сообщении, чтобы не светить его в URL
    // (query-параметры попадают в логи прокси/браузера).
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "auth", token }));
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const result = wsServerEventSchema.safeParse(JSON.parse(event.data));
        if (!result.success) {
          console.warn("Ignored invalid WS message", result.error);
          return;
        }
        const parsed = result.data;
        if (parsed.type === "auth:ok") {
          reconnectAttemptRef.current = 0;
          setIsConnected(true);
          return;
        }
        // Отвечаем на серверный ping для поддержания keep-alive.
        // Сервер (wsManager.ts) шлёт {type:"ping"} каждые 30 сек и ждёт
        // {type:"pong"} в течение 60 сек (PONG_TIMEOUT_MS). Без ответа
        // соединение закрывается с кодом 1001 "Pong timeout".
        if (parsed.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (parsed.type === "pong") return; // Игнорируем ответ сервера на наш pong
        setLastMessage(parsed);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };

    ws.onclose = async (e) => {
      if (disposedRef.current || wsRef.current !== ws) return;
      setIsConnected(false);
      wsRef.current = null;

      // 1008 Policy Violation (стандарт), 4401 (наш кастомный код) —
      // токен протух/невалиден: пробуем обновить и переподключиться.
      if (e.code === 1008 || e.code === 4401) {
        // Refresh уже идёт (например, из-за 401 в HTTP-клиенте) — просто
        // ждём его завершения. Подписка onRefreshEnd переподключит нас.
        if (apiClient.isRefreshing()) {
          return;
        }

        // apiClient.tryRefresh() сам обеспечивает single-flight.
        const refreshResult = await apiClient.tryRefresh();

        if (refreshResult === "success") {
          if (!disposedRef.current) connectRef.current();
        } else if (refreshResult === "transient-failure") {
          scheduleReconnectRef.current();
        }
        return;
      }

      // Обычный реконнект при обрыве сети
      scheduleReconnectRef.current();
    };

    ws.onerror = () => {
      // Browser handles the error details.
      // `onclose` will be called right after `onerror`.
    };
  }, []);

  useEffect(() => {
    const unsubscribeRefreshEnd = apiClient.onRefreshEnd((result) => {
      if (result !== "success" || disposedRef.current || wsRef.current || reconnectTimeoutRef.current) return;

      // ApiClient emits refreshEnd immediately before clearing refreshPromise.
      // Reconnect on the next task so connect() observes isRefreshing() === false.
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!disposedRef.current) connectRef.current();
      }, 0);
    });

    return unsubscribeRefreshEnd;
  }, []);

  // Синхронизируем актуальную ссылку для самовызовов внутри connect (reconnect)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  // Токен обновился (успешный refresh где-то в приложении) — если соединение
  // закрыто и reconnect не запланирован, пробуем переподключиться сразу.
  useEffect(() => {
    const unsubscribeTokenUpdate = apiClient.onTokenUpdate(() => {
      if (!wsRef.current && !reconnectTimeoutRef.current) {
        connectRef.current();
      }
    });

    return () => {
      unsubscribeTokenUpdate();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close(1000, "Provider disconnected");
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    if (accessToken) {
      connect();
    }

    const resume = () => {
      if (accessToken && navigator.onLine && document.visibilityState !== "hidden") {
        reconnectAttemptRef.current = 0;
        connectRef.current();
      }
    };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);

    return () => {
      disposedRef.current = true;
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      disconnect();
    };
  }, [accessToken, connect, disconnect]);

  const send = useCallback((event: WsClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  const value = useMemo(() => ({ isConnected, send, lastMessage }), [isConnected, send, lastMessage]);

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
};
