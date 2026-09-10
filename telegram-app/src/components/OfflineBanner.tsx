import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Паритет VK OfflineBanner: предупреждение о stale-данных и
 * подтверждение восстановления соединения (role=status, aria-live).
 */
export function OfflineBanner() {
  const { isOnline, wasOffline } = useOnlineStatus();
  if (isOnline && !wasOffline) return null;
  const reconnected = isOnline && wasOffline;
  return (
    <div
      className="OfflineBanner"
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      {reconnected
        ? "Соединение восстановлено"
        : "Нет подключения. Показанные данные могут быть устаревшими"}
    </div>
  );
}
