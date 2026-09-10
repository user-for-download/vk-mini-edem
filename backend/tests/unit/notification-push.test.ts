// backend/tests/unit/notification-push.test.ts
//
// Проверяем подключение TG-доставки в createNotification (tg-migration-26,
// VK push удалён): deliver вызывается для TG-пользователей после записи,
// критичные события игнорируют выключенный тумблер пользователя.
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const notificationCreate = vi.fn().mockResolvedValue({});
const notificationFindFirst = vi.fn().mockResolvedValue(null);

vi.mock("../../src/db.js", () => ({
  db: {
    user: { findUnique },
    notification: {
      create: notificationCreate,
      findFirst: notificationFindFirst,
    },
  },
}));

const deliverMock = vi.fn().mockResolvedValue({ delivered: true });
vi.mock("../../src/services/telegramNotifications.js", async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    deliverTelegramNotification: (...args: unknown[]) =>
      deliverMock(...args),
  };
});

vi.mock("../../src/logger.js", () => ({
  logger: { error: vi.fn(), debug: vi.fn() },
}));

const { createNotification } = await import(
  "../../src/services/notification.service.js"
);

describe("createNotification — TG delivery wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationCreate.mockResolvedValue({});
    notificationFindFirst.mockResolvedValue(null);
  });

  it("critical + telegramUserId → запись и deliver с deep-link", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      telegramUserId: 123n,
      notificationsEnabled: true,
    });

    await createNotification("u1", "trip_cancelled", "Поездка отменена", "Текст", "/bookings");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(deliverMock).toHaveBeenCalledWith({
      userId: "u1",
      type: "trip_cancelled",
      title: "Поездка отменена",
      body: "Текст",
      fragment: "/bookings",
    });
  });

  it("non-critical + toggle on → запись и deliver", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      telegramUserId: 123n,
      notificationsEnabled: true,
    });

    await createNotification("u1", "booking_created", "Новая заявка", "Текст");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(deliverMock).toHaveBeenCalledTimes(1);
  });

  it("без telegramUserId → только запись, без deliver", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      telegramUserId: null,
      notificationsEnabled: true,
    });

    await createNotification("u1", "trip_cancelled", "T", "B");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(deliverMock).not.toHaveBeenCalled();
  });

  it("выключенный тумблер + critical → запись и deliver всё равно", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      telegramUserId: 123n,
      notificationsEnabled: false,
    });

    await createNotification("u1", "booking_status_changed", "T", "B", "/bookings");

    expect(notificationCreate).toHaveBeenCalledTimes(1);
    expect(deliverMock).toHaveBeenCalledTimes(1);
  });

  it("выключенный тумблер + non-critical → ни записи, ни deliver", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      telegramUserId: 123n,
      notificationsEnabled: false,
    });

    await createNotification("u1", "booking_created", "T", "B");

    expect(notificationCreate).not.toHaveBeenCalled();
    expect(deliverMock).not.toHaveBeenCalled();
  });
});
