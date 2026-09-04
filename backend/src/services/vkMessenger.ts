// backend/src/services/vkMessenger.ts
import { env } from "../env.js";
import { logger } from "../logger.js";

const VK_API_URL = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";

/**
 * Отправка личного сообщения пользователю от имени сообщества
 * через VK API messages.send.
 *
 * Требования VK:
 * - community token с правом messages (VK_GROUP_TOKEN);
 * - пользователь должен разрешить сообщения от сообщества
 *   (VKWebAppAllowMessagesFromGroup) — иначе ошибка
 *   "Can't send messages for users without permission".
 *
 * Сервис никогда не бросает исключения наружу: если токен не задан
 * или VK вернул ошибку — логируем и тихо пропускаем, чтобы
 * основной бизнес-флоу (бронирование и т.п.) не ломался.
 */
export async function sendVkMessage(
  vkUserId: number,
  text: string
): Promise<boolean> {
  const token = env.VK_GROUP_TOKEN;
  if (!token || !env.VK_GROUP_ID) {
    // Интеграция не настроена — не критично.
    logger.debug({ vkUserId }, "vk_message_skipped_no_config");
    return false;
  }

  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    logger.warn({ vkUserId }, "vk_message_skipped_invalid_user");
    return false;
  }

  const params = new URLSearchParams({
    access_token: token,
    v: VK_API_VERSION,
    user_id: String(vkUserId),
    random_id: randomId(),
    message: text,
    group_id: String(env.VK_GROUP_ID),
  });

  try {
    const response = await fetch(`${VK_API_URL}/messages.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      logger.error(
        { vkUserId, status: response.status },
        "vk_message_http_error"
      );
      return false;
    }

    const body = (await response.json()) as {
      response?: number;
      error?: { error_code?: number; error_msg?: string };
    };

    if (body.response) {
      logger.info({ vkUserId, messageId: body.response }, "vk_message_sent");
      return true;
    }

    if (body.error) {
      // 901 — пользователь запретил сообщения; 7 — нет доступа.
      // Не роняем флоу, но логируем для диагностики.
      logger.warn(
        { vkUserId, code: body.error.error_code, msg: body.error.error_msg },
        "vk_message_api_error"
      );
    }
    return false;
  } catch (error) {
    logger.error({ err: error, vkUserId }, "vk_message_failed");
    return false;
  }
}

/**
 * random_id обязателен для messages.send (идемпотентность).
 * Уникален для каждого вызова, стабилен для повторов не нужен,
 * поэтому достаточно случайного целого числа.
 */
function randomId(): string {
  return String(Math.floor(Math.random() * 2 ** 31));
}
