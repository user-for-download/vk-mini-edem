// mini-app/src/components/OfflineBanner.tsx
import { type FC } from "react";
import { Flex, Text } from "@vkontakte/vkui";
import { Icon16Done, Icon16ErrorCircle } from "@vkontakte/icons";

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
    <Flex
      align="center"
      justify="center"
      gap={6}
      role="status"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        padding: "8px 16px",
        fontSize: 13,
        background: isReconnected
          ? "var(--vkui--color_background_positive, #4bb34b)"
          : "var(--vkui--color_background_negative, #e64646)",
        color: "#fff",
        transition: "background 0.3s ease",
        textAlign: "center",
      }}
    >
      {isReconnected ? <Icon16Done /> : <Icon16ErrorCircle />}
      <Text weight="2">
        {isReconnected
          ? "Соединение восстановлено"
          : "Нет подключения к интернету"}
      </Text>
    </Flex>
  );
};
