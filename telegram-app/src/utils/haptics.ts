import { hapticFeedback } from "@telegram-apps/sdk-react";

/**
 * Тактильная отдача в одном месте (язык примера edem-telegram-mini-app,
 * поверх sdk-react): все вызовы через ifAvailable — в браузере и SSR
 * безопасно становятся no-op, в Telegram-клиенте дают нативный отклик.
 */
export const haptic = {
  light: () => void hapticFeedback.impactOccurred.ifAvailable("light"),
  medium: () => void hapticFeedback.impactOccurred.ifAvailable("medium"),
  heavy: () => void hapticFeedback.impactOccurred.ifAvailable("heavy"),
  selection: () => void hapticFeedback.selectionChanged.ifAvailable(),
  success: () => void hapticFeedback.notificationOccurred.ifAvailable("success"),
  warning: () => void hapticFeedback.notificationOccurred.ifAvailable("warning"),
  error: () => void hapticFeedback.notificationOccurred.ifAvailable("error"),
};
