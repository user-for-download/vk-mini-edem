import { z } from "zod";

/** User notification returned by GET /notifications/my and PATCH /:id/read. */
export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;

/** Cursor page returned by GET /notifications/my. */
export const notificationsPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().min(0).optional(),
});

export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
