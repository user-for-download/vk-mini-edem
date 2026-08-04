import { useState, useEffect, useCallback } from "react";

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

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setWasOffline(true);
    setTimeout(() => setWasOffline(false), 3000);
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
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
