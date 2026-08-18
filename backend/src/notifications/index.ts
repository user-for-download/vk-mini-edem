import { Hono } from "hono";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { z } from "zod";

export const notificationsRouter = new Hono<AuthEnv>();

const notificationCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

notificationsRouter.use("*", requireUser);

notificationsRouter.get("/my", async (c) => {
  const user = c.get("user");
  const cursorStr = c.req.query("cursor");
  const limitRaw = Number(c.req.query("limit") || 20);
  const limit = Number.isInteger(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 50)
    : 20;

  let cursor: { createdAt: Date; id: string } | undefined;
  if (cursorStr) {
    try {
      const parsed = JSON.parse(Buffer.from(cursorStr, "base64").toString("utf-8"));
      const validated = notificationCursorSchema.parse(parsed);
      cursor = { createdAt: new Date(validated.createdAt), id: validated.id };
    } catch {
      return c.json({ message: "Invalid cursor" }, 400);
    }
  }

  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = Buffer.from(
      JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })
    ).toString("base64");
  }

  const unreadCount = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return c.json({ items, nextCursor, unreadCount });
});

notificationsRouter.patch("/:id/read", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== user.id) {
    return c.json({ message: "Not found" }, 404);
  }

  const updated = await db.notification.update({
    where: { id },
    data: { isRead: true },
  });

  return c.json(updated);
});

notificationsRouter.patch("/read-all", async (c) => {
  const user = c.get("user");
  await db.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  return c.json({ success: true });
});
