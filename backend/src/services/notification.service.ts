import { db } from "../db.js";
import { logger } from "../logger.js";

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
  body: string
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
    
    // TODO: Здесь можно добавить отправку VK Push через VK API
  } catch (error) {
    logger.error({ err: error }, "Failed to create notification");
  }
}
