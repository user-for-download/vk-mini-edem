import { useEffect, useRef } from "react";
import { settingsButton } from "@telegram-apps/sdk-react";

/**
 * Нативная кнопка настроек Telegram (язык примера edem-telegram-mini-app):
 * вне профиля — видна, тап ведёт в профиль; в профиле — скрыта.
 * Mount выполняется один раз в init.ts рядом с backButton.
 */
export function useSettingsButton(onOpenSettings: () => void, enabled = true): void {
  const handler = useRef(onOpenSettings);
  handler.current = onOpenSettings;

  useEffect(() => {
    if (!enabled) {
      settingsButton.hide.ifAvailable();
      return;
    }
    const listener = () => handler.current();
    settingsButton.show.ifAvailable();
    settingsButton.onClick.ifAvailable(listener);
    return () => {
      settingsButton.offClick.ifAvailable(listener);
      settingsButton.hide.ifAvailable();
    };
  }, [enabled]);
}
