import { db } from "../db.js";
import { logger } from "../logger.js";

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string
) {
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.notificationsEnabled) return;

    await db.notification.create({
      data: { userId, type, title, body },
    });
    
    // TODO: Здесь можно добавить отправку VK Push через VK API
  } catch (error) {
    logger.error({ err: error }, "Failed to create notification");
  }
}
