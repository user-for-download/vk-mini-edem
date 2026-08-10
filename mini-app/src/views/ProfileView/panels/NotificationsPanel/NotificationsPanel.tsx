import { type FC, useEffect, useState } from "react";
import {
  Caption,
  Group,
  Header,
  Panel,
  PanelHeaderBack,
  Separator,
  SimpleCell,
  Switch,
  Box,
} from "@vkontakte/vkui";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { usersApi } from "@/api/users.api";

export interface NotificationsPanelProps {
  id: string;
  onBack: () => void;
}

interface NotificationSettings {
  disableAll: boolean;
  tripsPush: boolean;
  tripsSound: boolean;
  news: boolean;
}

const STORAGE_KEY = "edem_notification_settings";

const DEFAULT_SETTINGS: NotificationSettings = {
  disableAll: false,
  tripsPush: true,
  tripsSound: true,
  news: false,
};

function loadSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;

    return {
      disableAll:
        typeof parsed.disableAll === "boolean"
          ? parsed.disableAll
          : DEFAULT_SETTINGS.disableAll,
      tripsPush:
        typeof parsed.tripsPush === "boolean"
          ? parsed.tripsPush
          : DEFAULT_SETTINGS.tripsPush,
      tripsSound:
        typeof parsed.tripsSound === "boolean"
          ? parsed.tripsSound
          : DEFAULT_SETTINGS.tripsSound,
      news:
        typeof parsed.news === "boolean"
          ? parsed.news
          : DEFAULT_SETTINGS.news,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

/**
 * Настройки уведомлений.
 *
 * Текущее поведение:
 * - настройки сохраняются локально;
 * - реальная push-доставка пока не подключена;
 * - пользователь явно видит, что push появится позже.
 */
export const NotificationsPanel: FC<NotificationsPanelProps> = ({
  id,
  onBack,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(loadSettings);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!showSaved) {
      return;
    }

    const timer = setTimeout(() => {
      setShowSaved(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [showSaved]);

  const updateSettings = (patch: Partial<NotificationSettings>) => {
    // Побочные эффекты (saveSettings/setShowSaved) — вне setState-апдейтера:
    // StrictMode вызывает апдейтеры дважды, а localStorage-запись не идемпотентна.
    const next: NotificationSettings = {
      ...settings,
      ...patch,
    };

    setSettings(next);
    saveSettings(next);
    setShowSaved(true);
  };

  const toggleNotifications = async (enabled: boolean) => {
    setSettings((prev) => ({ ...prev, disableAll: !enabled }));
    try {
      await usersApi.updateNotificationSettings(enabled);
      setShowSaved(true);
    } catch {
      setSettings((prev) => ({ ...prev, disableAll: !enabled })); // Откат при ошибке
    }
  };

  const isDisabled = settings.disableAll;

  return (
    <Panel id={id}>
      <AppPanelHeader
        before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}
      >
        Уведомления
      </AppPanelHeader>

      <Group>
        <SimpleCell
          Component="label"
          subtitle="Отключить все уведомления в приложении"
          after={
            <Switch
              checked={settings.disableAll}
              onChange={(e) => toggleNotifications(!e.target.checked)}
            />
          }
        >
          Выключить все уведомления
        </SimpleCell>

        {showSaved && (
          <Box padding="system" paddingBlockStart={0}>
            <Caption level="1" className="NotificationsPanel__savedNote">
              Настройки сохранены
            </Caption>
          </Box>
        )}
      </Group>

      <Group header={<Header size="s">О поездках</Header>}>
        <SimpleCell
          Component="label"
          subtitle="Новые заявки, подтверждения, изменения в поездке"
          disabled={isDisabled}
          after={
            <Switch
              checked={settings.tripsPush}
              disabled={isDisabled}
              onChange={(e) =>
                updateSettings({ tripsPush: e.target.checked })
              }
            />
          }
        >
          Push-уведомления
        </SimpleCell>

        <Separator />

        <SimpleCell
          Component="label"
          subtitle="Звук и вибрация для уведомлений о поездках"
          disabled={isDisabled}
          after={
            <Switch
              checked={settings.tripsSound}
              disabled={isDisabled}
              onChange={(e) =>
                updateSettings({ tripsSound: e.target.checked })
              }
            />
          }
        >
          Звук и вибрация
        </SimpleCell>
      </Group>

      <Group header={<Header size="s">Прочее</Header>}>
        <SimpleCell
          Component="label"
          subtitle="Скоро: скидки, новые маршруты, новости сервиса"
          disabled
          after={
            <Switch
              checked={settings.news}
              disabled
              onChange={(e) => updateSettings({ news: e.target.checked })}
            />
          }
        >
          Новости и акции
        </SimpleCell>
      </Group>

      <Box padding="system">
        <Caption
          level="1"
          className="NotificationsPanel__footnote"
        >
          Настройки сохраняются на этом устройстве. Доставка push-уведомлений
          появится в одном из следующих обновлений.
        </Caption>
      </Box>
    </Panel>
  );
};
