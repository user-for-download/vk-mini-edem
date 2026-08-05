import { z } from "zod";
import { apiClient } from "./client";

export const notificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationsPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().optional(),
});

export type NotificationsPage = z.infer<typeof notificationsPageSchema>;

export const notificationsApi = {
  getMy: (cursor?: string, limit = 20): Promise<NotificationsPage> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.set("cursor", cursor);
    }
    return apiClient.request<NotificationsPage>(
      `/notifications/my?${params.toString()}`,
      {},
      notificationsPageSchema
    );
  },

  markRead: (id: string): Promise<Notification> => {
    return apiClient.request<Notification>(
      `/notifications/${id}/read`,
      { method: "PATCH" },
      notificationSchema
    );
  },

  markAllRead: (): Promise<{ success: boolean }> => {
    return apiClient.request<{ success: boolean }>("/notifications/read-all", {
      method: "PATCH",
    });
  },
};