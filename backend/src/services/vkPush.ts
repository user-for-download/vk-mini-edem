// backend/src/services/vkPush.ts
import { env } from "../env.js";
import { logger } from "../logger.js";

const VK_API_URL = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";

/**
 * Отправка push-уведомления пользователю мини-аппа через VK API
 * notifications.sendMessage (серверный метод, сервисный ключ доступа).
 *
 * В отличие от messages.send (сообщение от сообщества, см. vkMessenger.ts),
 * это именно push-уведомление: оно приходит, даже когда приложение закрыто,
 * а параметр fragment задаёт deep-link (hash-маршрут мини-аппа), по которому
 * откроется нужный экран при тапе на уведомление.
 *
 * Требования VK:
 * - сервисный ключ доступа мини-аппа (VK_SERVICE_KEY);
 * - пользователь должен разрешить уведомления (VKWebAppAllowNotifications).
 *
 * Сервис никогда не бросает исключения наружу: если ключ не задан или VK
 * вернул ошибку — логируем и тихо пропускаем, чтобы основной бизнес-флоу
 * (бронирование, отмена и т.п.) не ломался.
 */
export async function sendVkPush(
  vkUserId: number,
  message: string,
  fragment?: string
): Promise<boolean> {
  const token = env.VK_SERVICE_KEY;
  if (!token) {
    // Интеграция не настроена — не критично.
    logger.debug({ vkUserId }, "vk_push_skipped_no_config");
    return false;
  }

  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    logger.warn({ vkUserId }, "vk_push_skipped_invalid_user");
    return false;
  }

  const params = new URLSearchParams({
    user_ids: String(vkUserId),
    message,
    v: VK_API_VERSION,
  });
  if (fragment) {
    params.set("fragment", fragment);
  }

  try {
    const response = await fetch(`${VK_API_URL}/notifications.sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: params,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logger.error(
        { vkUserId, status: response.status },
        "vk_push_http_error"
      );
      return false;
    }

    const body = (await response.json()) as {
      response?: unknown;
      error?: { error_code?: number; error_msg?: string };
    };

    if (body.error) {
      // Например, пользователь не разрешил уведомления. Не роняем флоу,
      // но логируем для диагностики.
      logger.warn(
        { vkUserId, code: body.error.error_code, msg: body.error.error_msg },
        "vk_push_api_error"
      );
      return false;
    }

    if (body.response !== undefined) {
      logger.info({ vkUserId }, "vk_push_sent");
      return true;
    }

    return false;
  } catch (error) {
    logger.error({ err: error, vkUserId }, "vk_push_failed");
    return false;
  }
}
