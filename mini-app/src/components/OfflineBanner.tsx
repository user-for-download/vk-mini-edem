// mini-app/src/components/OfflineBanner.tsx
import { type FC } from "react";
import { Flex, Text, FixedLayout } from "@vkontakte/vkui";
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
    <FixedLayout vertical="top">
      <Flex
        align="center"
        justify="center"
        gap={6}
        role="status"
        aria-live="assertive"
      >
        {isReconnected ? <Icon16Done /> : <Icon16ErrorCircle />}
        <Text weight="2">
          {isReconnected ? "Соединение восстановлено" : "Нет подключения к интернету"}
        </Text>
      </Flex>
    </FixedLayout>
  );
};