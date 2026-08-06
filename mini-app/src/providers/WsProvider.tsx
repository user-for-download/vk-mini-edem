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

export const WsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsServerEvent | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (isRefreshingRef.current) return;

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
        if (parsed.type === "pong") return; // Internal keep-alive or ignore
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
        isRefreshingRef.current = true;
        try {
          const refreshed = await apiClient.tryRefresh();
          if (refreshed) {
            connect();
          } else {
            // Refresh не удался — сессия мертва, полный логаут.
            useAuthStore.getState().clearSession("WS Auth failed");
          }
        } finally {
          isRefreshingRef.current = false;
        }
        return;
      }

      // Обычный реконнект при обрыве сети
      reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      // Browser handles the error details. 
      // `onclose` will be called right after `onerror`.
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
