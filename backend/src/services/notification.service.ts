import { db } from "../db.js";
import { logger } from "../logger.js";
import {
  deliverTelegramNotification,
  findTelegramDuplicate,
  TELEGRAM_CRITICAL_TYPES,
} from "./telegramNotifications.js";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  /** Deep-link (маршрут Telegram-приложения) для tap-destination уведомления. */
  fragment?: string
) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return;
    // Критичные уведомления создаются независимо от тумблера.
    // Некритичные (booking_created, trip_details_changed и др.)
    // подчиняются настройкам пользователя.
    // Критичные типы — единый источник в telegramNotifications.ts
    // (комментарий о бизнес-контракте см. там): создаются в БД всегда,
    // даже если пользователь выключил общий тумблер.
    const isCritical = TELEGRAM_CRITICAL_TYPES.has(type);
    if (!user.notificationsEnabled && !isCritical) return;

    // Дедуп: повтор того же события внутри окна не плодит записи.
    const isTelegramUser = user.telegramUserId != null;
    if (isTelegramUser) {
      const duplicate = await findTelegramDuplicate({
        userId,
        type,
        title,
        body,
      });
      if (duplicate) {
        logger.debug({ userId, type }, "tg_notification_duplicate_skipped");
        return;
      }
    }

    await db.notification.create({
      data: { userId, type, title, body },
    });

    // TG-доставка: inbox-запись уже создана выше; здесь валидация
    // deep-link и наблюдаемость исхода. Внешних вызовов нет —
    // Bot API заблокирован (см. ADR telegram-notification-delivery).
    if (isTelegramUser) {
      void deliverTelegramNotification({ userId, type, title, body, fragment });
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to create notification");
  }
}
