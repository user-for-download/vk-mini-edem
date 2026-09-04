import { useEnableSwipeBack } from "@vkontakte/vk-mini-apps-router";

/**
 * Синхронизирует свайп-назад VK Mini Apps с роутером приложения.
 */
export function SwipeBackSync() {
  useEnableSwipeBack();
  return null;
}
