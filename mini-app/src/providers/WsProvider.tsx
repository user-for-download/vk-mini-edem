import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { apiClient } from "../api/client";
import { useAuthStore } from "../store/useAuthStore";
import type { WsClientEvent, WsServerEvent } from "@edem/contracts";

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

// Константы вместо magic numbers.
const WS_RECONNECT_DELAY_MS = 3_000;
const WS_REFRESH_WAIT_DELAY_MS = 1_000;

export const WsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsServerEvent | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // connect вызывается сам из себя (reconnect в onclose), а самоссылка
  // в инициализаторе useCallback запрещена (react-hooks/immutability).
  // Храним актуальную ссылку в рефе — identity connect стабильна (deps []),
  // поэтому эффект ниже отрабатывает один раз.
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    // Если идёт refresh (из HTTP-клиента или WsProvider) — не пытаемся
    // переподключиться: после завершения нас разбудит onTokenUpdate.
    if (apiClient.isRefreshing()) return;

    const token = apiClient.getToken();
    if (!token) return; // Wait until token is available

    // Токен передаём только в auth-сообщении, чтобы не светить его в URL
    // (query-параметры попадают в логи прокси/браузера).
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "auth", token }));
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as WsServerEvent;
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
      setIsConnected(false);
      wsRef.current = null;

      // 1008 Policy Violation (стандарт), 4401 (наш кастомный код) —
      // токен протух/невалиден: пробуем обновить и переподключиться.
      if (e.code === 1008 || e.code === 4401) {
        console.warn("[WS] Auth failed, trying to refresh token...");

        // Refresh уже идёт (например, из-за 401 в HTTP-клиенте) — просто
        // ждём его завершения. После успеха onTokenUpdate переподключит нас.
        if (apiClient.isRefreshing()) {
          console.log("[WS] Refresh already in progress, waiting...");
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectRef.current();
          }, WS_REFRESH_WAIT_DELAY_MS);
          return;
        }

        // apiClient.tryRefresh() сам обеспечивает single-flight.
        const refreshed = await apiClient.tryRefresh();

        if (refreshed) {
          connectRef.current();
        } else {
          // Refresh не удался — сессия мертва, полный логаут.
          useAuthStore.getState().clearSession("WS Auth failed");
        }
        return;
      }

      // Обычный реконнект при обрыве сети
      reconnectTimeoutRef.current = window.setTimeout(
        () => connectRef.current(),
        WS_RECONNECT_DELAY_MS
      );
    };

    ws.onerror = () => {
      // Browser handles the error details. 
      // `onclose` will be called right after `onerror`.
    };
  }, []);

  // Синхронизируем актуальную ссылку для самовызовов внутри connect (reconnect)
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Токен обновился (успешный refresh где-то в приложении) — если соединение
  // закрыто и reconnect не запланирован, пробуем переподключиться сразу.
  useEffect(() => {
    const unsubscribeTokenUpdate = apiClient.onTokenUpdate(() => {
      if (!wsRef.current && !reconnectTimeoutRef.current) {
        console.log("[WS] Token updated, reconnecting...");
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
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Poll for token existence since we don't have a reactive token hook here yet
  useEffect(() => {
    const interval = setInterval(() => {
      const token = apiClient.getToken();
      if (token && !wsRef.current && !reconnectTimeoutRef.current) {
        connect();
      } else if (!token && wsRef.current) {
        disconnect();
      }
    }, 1000);
    
    return () => {
      clearInterval(interval);
      disconnect();
    };
  }, [connect, disconnect]);

  const send = useCallback((event: WsClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  const value = useMemo(() => ({ isConnected, send, lastMessage }), [isConnected, send, lastMessage]);

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
};
