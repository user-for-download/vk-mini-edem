import { db } from "../db.js";
import { logger } from "../logger.js";
import { sendVkPush } from "./vkPush.js";

/**
 * Типы уведомлений, которые создаются в БД всегда,
 * даже если пользователь выключил общий тумблер.
 * Без них пользователь не узнает об изменении статуса брони
 * или отмене поездки — это нарушает бизнес-контракт.
 */
const CRITICAL_NOTIFICATION_TYPES = new Set([
  "booking_status_changed",
  "trip_cancelled",
  "trip_status_changed",
]);

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  /** Deep-link (hash-маршрут мини-аппа) для тапа по push-уведомлению. */
  fragment?: string
) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return;
    // Критичные уведомления создаются независимо от тумблера.
    // Некритичные (booking_created, trip_details_changed и др.)
    // подчиняются настройкам пользователя.
    const isCritical = CRITICAL_NOTIFICATION_TYPES.has(type);
    if (!user.notificationsEnabled && !isCritical) return;

    await db.notification.create({
      data: { userId, type, title, body },
    });

    // Реальный VK push — только для критичных событий и при наличии vkUserId.
    // sendVkPush глотает ошибки внутри (ключ не настроен, пользователь не
    // разрешил уведомления, сеть) — основной бизнес-флоу не ломается.
    // Сообщество-сообщения (messages.send) отправляются отдельно в
    // поддерживаемых сценариях (сейчас новая заявка, см. bookings).
    if (isCritical && user.vkUserId != null) {
      void sendVkPush(user.vkUserId, body, fragment);
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to create notification");
  }
}
