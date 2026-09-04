// backend/tests/unit/notification-push.test.ts
//
// Проверяем подключение реального VK push в createNotification:
// push отправляется только для критичных типов и при наличии vkUserId,
// критичные события игнорируют выключенный тумблер пользователя.
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const notificationCreate = vi.fn().mockResolvedValue({});

vi.mock("../../src/db.js", () => ({
  db: {
    user: { findUnique },
    notification: { create: notificationCreate },
  },
}));

const sendVkPushMock = vi.fn().mockResolvedValue(true);
vi.mock("../../src/services/vkPush.js", () => ({
  sendVkPush: (...args: unknown[]) => sendVkPushMock(...args),
}));

vi.mock("../../src/logger.js", () => ({
  logger: { error: vi.fn() },
}));

const { createNotification } = await import(
  "../../src/services/notification.service.js"
);

describe("createNotification — VK push wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationCreate.mockResolvedValue({});
  });

  it("critical + vkUserId → отправляет push с body и fragment", async () => {
    findUnique.mockResolvedValue({ id: "u1", vkUserId: 123, notificationsEnabled: true });

    await createNotification("u1", "trip_cancelled", "Поездка отменена", "Текст", "/bookings");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(sendVkPushMock).toHaveBeenCalledWith(123, "Текст", "/bookings");
  });

  it("non-critical → push не отправляется (только DB-запись)", async () => {
    findUnique.mockResolvedValue({ id: "u1", vkUserId: 123, notificationsEnabled: true });

    await createNotification("u1", "booking_created", "Новая заявка", "Текст");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(sendVkPushMock).not.toHaveBeenCalled();
  });

  it("critical без vkUserId → push не отправляется", async () => {
    findUnique.mockResolvedValue({ id: "u1", vkUserId: null, notificationsEnabled: true });

    await createNotification("u1", "trip_cancelled", "T", "B");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(sendVkPushMock).not.toHaveBeenCalled();
  });

  it("выключенный тумблер + critical → запись и push всё равно создаются", async () => {
    findUnique.mockResolvedValue({ id: "u1", vkUserId: 123, notificationsEnabled: false });

    await createNotification("u1", "booking_status_changed", "T", "B", "/bookings");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(sendVkPushMock).toHaveBeenCalledWith(123, "B", "/bookings");
  });

  it("выключенный тумблер + non-critical → ни записи, ни push", async () => {
    findUnique.mockResolvedValue({ id: "u1", vkUserId: 123, notificationsEnabled: false });

    await createNotification("u1", "booking_created", "T", "B");

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(sendVkPushMock).not.toHaveBeenCalled();
  });
});
