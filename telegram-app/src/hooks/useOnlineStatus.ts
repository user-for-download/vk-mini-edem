// telegram-app/src/hooks/useOnlineStatus.ts
// Паритет VK OfflineBanner: единый источник онлайн-статуса для TG.
// wasOffline нужен, чтобы кратко показать «Соединение восстановлено».
import { useSyncExternalStore, useRef, useState, useEffect } from "react";

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus(): { isOnline: boolean; wasOffline: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, () => true);
  const [wasOffline, setWasOffline] = useState(false);
  const offlineSeenRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      offlineSeenRef.current = true;
      setWasOffline(false);
    } else if (offlineSeenRef.current) {
      setWasOffline(true);
    }
  }, [isOnline]);

  return { isOnline, wasOffline };
}
