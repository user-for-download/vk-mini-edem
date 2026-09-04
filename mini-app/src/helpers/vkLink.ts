// mini-app/src/helpers/vkLink.ts
import { openExternalUrl } from "@/helpers/bridge";

/**
 * Базовый URL личных сообщений ВКонтакте.
 * Каноническая «ссылка на диалог» — vk.com/im?sel=<user_id>:
 * открытие ведёт прямо в диалог с пользователем в VK-мессенджере.
 */
const VK_MESSAGES_BASE = "https://vk.com/im";

/**
 * Строит ссылку на личные сообщения с пользователем VK.
 * Чистая функция: по числовому VK ID возвращает
 * `https://vk.com/im?sel=<vkUserId>`.
 */
export function buildVkMessageUrl(vkUserId: number): string {
  return `${VK_MESSAGES_BASE}?sel=${vkUserId}`;
}

/**
 * Открывает личные сообщения с пользователем VK (через VKWebAppOpenUrl
 * с браузерным фолбэком). Используется кнопкой «Написать» после
 * брони/подтверждения поездки.
 */
export async function openVkMessages(vkUserId: number): Promise<void> {
  await openExternalUrl(buildVkMessageUrl(vkUserId));
}
