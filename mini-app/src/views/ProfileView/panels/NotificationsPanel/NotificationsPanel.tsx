import { type FC, useEffect, useState } from "react";
import {
  Caption,
  Group,
  Panel,
  PanelHeaderBack,
  SimpleCell,
  Switch,
  Box,
  Button,
  Banner,
} from "@vkontakte/vkui";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { usersApi } from "@/api/users.api";
import { bridge, requestNotificationsPermission, requestVkMessagesPermission } from "@/helpers/bridge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useAuthStore } from "@/store/useAuthStore";

export interface NotificationsPanelProps {
  id: string;
  onBack: () => void;
}

const VK_GROUP_ID = Number(import.meta.env.VITE_VK_GROUP_ID || 0);

/**
 * Настройки уведомлений.
 *
 * Текущее поведение:
 * - общий тумблер синхронизируется с backend;
 * - сообщения VK доступны, если интеграция сообщества настроена на сервере.
 */
export const NotificationsPanel: FC<NotificationsPanelProps> = ({
  id,
  onBack,
}) => {
  const currentUser = useCurrentUser();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    currentUser?.notificationsEnabled ?? true
  );
  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRequestingVkPermission, setIsRequestingVkPermission] = useState(false);
  // Статус push-уведомлений VK (notifications.sendMessage): null = ещё не прочитан,
  // true/false = известен. Источник — launch-параметр vk_are_notifications_enabled
  // (обновляется оптимистично после успешного запроса разрешения).
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const { enqueue } = useSnackbar();

  const requestVkPermission = async () => {
    if (VK_GROUP_ID <= 0 || isRequestingVkPermission) return;
    setIsRequestingVkPermission(true);
    const result = await requestVkMessagesPermission(VK_GROUP_ID);
    setIsRequestingVkPermission(false);

    enqueue({
      type: result === "success" ? "success" : result === "failed" ? "error" : "info",
      title:
        result === "success"
          ? "Сообщения VK включены"
          : result === "unsupported"
            ? "Функция недоступна в этом клиенте"
            : result === "cancelled"
              ? "Разрешение не предоставлено"
              : "Не удалось включить сообщения",
      dedupeKey: `vk_messages_${result}`,
    });
  };

  // Чтение текущего статуса push-разрешения из launch-параметров.
  // Паттерн гонки с таймаутом 3 с (как в useAuthStore): вне VK bridge.send
  // не отвечает, без таймаута UI зависнет. По таймауту/ошибке оставляем null
  // (UI покажет баннер «Включить» — безопасный дефолт).
  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const data = (await Promise.race([
          bridge.send("VKWebAppGetLaunchParams") as Promise<
            Record<string, unknown> | undefined
          >,
          new Promise<undefined>((resolve) =>
            setTimeout(() => resolve(undefined), 3000)
          ),
        ])) as Record<string, unknown> | undefined;
        if (!cancelled && data?.vk_are_notifications_enabled === 1) {
          setPushEnabled(true);
        } else if (!cancelled) {
          setPushEnabled(false);
        }
      } catch {
        if (!cancelled) setPushEnabled(false);
      }
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestPushPermission = async () => {
    if (isRequestingPush) return;
    setIsRequestingPush(true);
    const result = await requestNotificationsPermission();
    setIsRequestingPush(false);

    if (result === "success") {
      // Оптимистично отражаем выдачу разрешения до следующего запуска,
      // когда launch-параметр подтвердит статус.
      setPushEnabled(true);
    }

    enqueue({
      type: result === "success" ? "success" : result === "failed" ? "error" : "info",
      title:
        result === "success"
          ? "Push-уведомления VK включены"
          : result === "unsupported"
            ? "Функция недоступна в этом клиенте"
            : result === "cancelled"
              ? "Разрешение не предоставлено"
              : "Не удалось включить уведомления",
      dedupeKey: `vk_push_${result}`,
    });
  };

  useEffect(() => {
    if (!showSaved) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSaved(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showSaved]);

  const toggleNotifications = async (enabled: boolean) => {
    if (isSaving) {
      return;
    }

    const previous = notificationsEnabled;
    setNotificationsEnabled(enabled);
    setIsSaving(true);
    try {
      const updatedUser = await usersApi.updateNotificationSettings(enabled);
      useAuthStore.setState({ user: updatedUser });
      setShowSaved(true);
    } catch {
      setNotificationsEnabled(previous);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Уведомления
      </AppPanelHeader>

      <Group>
        {VK_GROUP_ID > 0 ? (
          <Banner
            title="Уведомления в сообщениях VK"
            subtitle="Разрешите сообществу отправлять поддерживаемые сервисные сообщения. Доставка работает только при настроенной серверной интеграции."
            actions={
              <Button loading={isRequestingVkPermission} onClick={() => void requestVkPermission()}>
                Разрешить
              </Button>
            }
          />
        ) : null}
        {pushEnabled === true ? (
          <SimpleCell
            subtitle="Включены — уведомления о брони, отмене и завершении поездки приходят даже при закрытом приложении."
          >
            Push-уведомления VK
          </SimpleCell>
        ) : (
          <Banner
            title="Push-уведомления VK"
            subtitle="Включите, чтобы узнавать о подтверждении брони, отмене поездки и завершении — даже когда приложение закрыто."
            actions={
              <Button
                loading={isRequestingPush}
                disabled={pushEnabled === null}
                onClick={() => void requestPushPermission()}
              >
                Включить
              </Button>
            }
          />
        )}
        <SimpleCell
          Component="label"
          subtitle="Критичные изменения статуса поездки и брони останутся доступными в приложении"
          after={
            <Switch
              checked={!notificationsEnabled}
              disabled={isSaving}
              onChange={(e) => toggleNotifications(!e.target.checked)}
            />
          }
        >
          Отключить некритичные уведомления
        </SimpleCell>

        {showSaved && (
          <Box padding="system" paddingBlockStart={0}>
            <Caption level="1" style={{ color: "var(--vkui--color_text_accent)" }}>
              Настройки сохранены
            </Caption>
          </Box>
        )}
      </Group>

      <Box padding="system">
        <Caption
          level="1"
          style={{ color: "var(--vkui--color_text_secondary)" }}
        >
          Настройка синхронизируется с аккаунтом. Отдельные настройки звука и
          типов уведомлений пока не поддерживаются.
        </Caption>
      </Box>
    </Panel>
  );
};
