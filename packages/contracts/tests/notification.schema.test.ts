import { describe, expect, it } from "vitest";
import {
  notificationSchema,
  notificationsPageSchema,
} from "../src/index.js";

const notification = {
  id: "n-1",
  userId: "u-1",
  type: "booking_status",
  title: "Бронь подтверждена",
  body: "Водитель подтвердил вашу бронь",
  isRead: false,
  createdAt: "2026-09-09T10:00:00.000Z",
};

describe("notification contracts", () => {
  it("accepts the backend notification representation", () => {
    expect(notificationSchema.parse(notification)).toEqual(notification);
  });

  it("accepts a notification page with a nullable cursor", () => {
    expect(
      notificationsPageSchema.parse({
        items: [notification],
        nextCursor: null,
        unreadCount: 1,
      }),
    ).toMatchObject({ items: [notification], nextCursor: null });
  });

  it("rejects malformed notification dates and counts", () => {
    expect(
      notificationSchema.safeParse({ ...notification, createdAt: "not-a-date" })
        .success,
    ).toBe(false);
    expect(
      notificationsPageSchema.safeParse({
        items: [],
        nextCursor: null,
        unreadCount: -1,
      }).success,
    ).toBe(false);
  });
});
