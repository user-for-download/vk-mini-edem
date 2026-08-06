/**
 * Стандартный VK-плейсхолдер «нет фото» (CDN VK).
 * Дублирует DEFAULT_AVATAR_URL с бэкенда — клиентский фолбэк на случай
 * пустого/битого значения.
 */
export const DEFAULT_AVATAR_URL = "https://vk.com/images/camera_200.png?ava=1";

/** Возвращает аватар пользователя или VK-плейсхолдер, если его нет. */
export function resolveAvatar(src?: string | null): string {
  return src?.trim() ? src : DEFAULT_AVATAR_URL;
}
