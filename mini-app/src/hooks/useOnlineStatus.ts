import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Отслеживает статус соединения с сетью.
 *
 * Возвращает:
 * - isOnline: текущий статус;
 * - wasOffline: был ли оффлайн с момента последнего рендера
 *   (для показа «Соединение восстановлено»).
 */
export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => setWasOffline(false), 3000);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
