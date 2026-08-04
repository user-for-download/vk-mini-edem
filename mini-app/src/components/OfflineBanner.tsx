import { type FC } from "react";

/**
 * Баннер, отображаемый при потере соединения.
 *
 * Показывается сверху приложения, перекрывая контент.
 * При восстановлении соединения кратко показывает «Соединение восстановлено».
 */
export const OfflineBanner: FC<{ isOnline: boolean; wasOffline: boolean }> = ({
  isOnline,
  wasOffline,
}) => {
  if (isOnline && !wasOffline) {
    return null;
  }

  const isReconnected = isOnline && wasOffline;

  return (
    <div
      role="status"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 16px",
        fontSize: 13,
        fontWeight: 500,
        color: "#fff",
        background: isReconnected
          ? "var(--vkui--color_background_positive, #4bb34b)"
          : "var(--vkui--color_background_negative, #e64646)",
        transition: "background 0.3s ease",
      }}
    >
      {isReconnected
        ? "Соединение восстановлено"
        : "⚠ Нет подключения к интернету"}
    </div>
  );
};
