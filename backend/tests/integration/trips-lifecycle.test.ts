import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

/**
 * Жизненный цикл поездки: создание → бронирование → подтверждение →
 * отмена/завершение (TOCTOU-защита в транзакциях).
 *
 * Паттерны репо (см. smoke.test.ts): app.request() вместо supertest,
 * dev-авторизация mock-токеном (tests/dev-mock-auth.js: allowlist + TTL),
 * уникальные vkUserId.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

interface TestUsers {
  driverId: string;
  passengerId: string;
  otherUserId: string;
}

describe("trip lifecycle: cancel/complete", () => {
  // vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
  let vkSeq = 2_200_000;
  let users: TestUsers;
  let tripId: string;
  let bookingId: string;

  const now = Date.now();

  async function createUser(name: string): Promise<string> {
    const user = await db.user.create({
      data: {
        name: `${name}-${now}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=7",
      },
    });
    return user.id;
  }

  async function createTrip(
    driverId: string,
    departureAt: Date = new Date("2030-01-01T09:00:00Z")
  ): Promise<string> {
    const trip = await db.trip.create({
      data: {
        driverId,
        fromCity: "Москва",
        fromAddress: "м. Тёплый Стан",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        departureAt,
        durationMinutes: 120,
        distanceKm: 180,
        price: 700,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
      },
    });
    return trip.id;
  }

  beforeEach(async () => {
    const driverId = await createUser("Driver");
    const passengerId = await createUser("Passenger");
    const otherUserId = await createUser("Other");
    users = { driverId, passengerId, otherUserId };

    await db.car.create({
      data: { userId: driverId, model: "Tesla", color: "Black", plate: "А001АА77" },
    });

    tripId = await createTrip(driverId);

    const booking = await db.booking.create({
      data: {
        tripId,
        passengerId,
        seat: 1,
        status: "confirmed",
        comment: "Тестовая бронь",
      },
    });
    bookingId = booking.id;
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { tripId } });
    await db.notification.deleteMany({ where: { userId: { in: Object.values(users) } } });
    await db.trip.deleteMany({ where: { driverId: users.driverId } });
    await db.car.deleteMany({ where: { userId: users.driverId } });
    await db.user.deleteMany({ where: { id: { in: Object.values(users) } } });
  });

  it("cancels an active trip: bookings → cancelled, passengers notified", async () => {
    const res = await app.request(`/api/v1/trips/${tripId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("cancelled");
    expect(body.seatsAvailable).toBe(0);

    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.status).toBe("cancelled");
    expect(dbTrip?.cancelledAt).not.toBeNull();
    expect(dbTrip?.cancelledByType).toBe("user");
    expect(dbTrip?.cancelledByUserId).toBe(users.driverId);

    const dbBooking = await db.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("cancelled");
    expect(dbBooking?.cancelledAt).not.toBeNull();
    expect(dbBooking?.cancelledByType).toBe("user");
    expect(dbBooking?.cancelledByUserId).toBe(users.driverId);

    // Пассажиру создано персистентное уведомление.
    const notification = await db.notification.findFirst({
      where: { userId: users.passengerId },
      orderBy: { createdAt: "desc" },
    });
    expect(notification?.type).toBe("trip_cancelled");
  });

  it("forbids cancel by a non-driver (403)", async () => {
    const res = await app.request(`/api/v1/trips/${tripId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.otherUserId)}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("rejects a partial city update that matches the stored opposite city", async () => {
    // После введения `updateTripDtoSchema.strict()` поле `toCity` запрещено
    // в PATCH (маршрут нельзя менять после создания поездки). Проверяем
    // только 400 — Zod возвращает «Unrecognized key: toCity», без кода.
    const res = await app.request(`/api/v1/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(users.driverId)}`,
      },
      body: JSON.stringify({ toCity: "Москва" }),
    });

    expect(res.status).toBe(400);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip?.toCity).toBe("Тула");
  });

  it("returns 404 for cancel of a missing trip", async () => {
    const res = await app.request(`/api/v1/trips/nonexistent/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(res.status).toBe(404);
  });

  it("rejects cancel of an already cancelled trip (400 TRIP_NOT_ACTIVE)", async () => {
    await app.request(`/api/v1/trips/${tripId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    const second = await app.request(`/api/v1/trips/${tripId}/cancel`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.code).toBe("TRIP_NOT_ACTIVE");
  });

  it("rejects complete before departure without force (400)", async () => {
    const res = await app.request(`/api/v1/trips/${tripId}/complete`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("TRIP_IN_PAST");
  });

  it("completes with force=1: pending declined, confirmed kept, tripsCount +1", async () => {
    // Вторая заявка — pending, должна стать declined.
    const pendingBooking = await db.booking.create({
      data: {
        tripId,
        passengerId: users.otherUserId,
        seat: 2,
        status: "pending",
        comment: "",
      },
    });

    const res = await app.request(`/api/v1/trips/${tripId}/complete?force=1`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("completed");

    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.status).toBe("completed");
    expect(dbTrip?.seatsAvailable).toBe(0);

    const confirmed = await db.booking.findUnique({ where: { id: bookingId } });
    expect(confirmed?.status).toBe("confirmed");

    const declined = await db.booking.findUnique({ where: { id: pendingBooking.id } });
    expect(declined?.status).toBe("declined");
    expect(declined?.cancelledByType).toBe("system");
    expect(declined?.cancellationReason).toBe("Trip completed");

    // tripsCount начислен водителю и подтверждённому пассажиру ровно один раз.
    const driver = await db.user.findUnique({ where: { id: users.driverId } });
    const passenger = await db.user.findUnique({ where: { id: users.passengerId } });
    const other = await db.user.findUnique({ where: { id: users.otherUserId } });
    expect(driver?.tripsCount).toBe(1);
    expect(passenger?.tripsCount).toBe(1);
    expect(other?.tripsCount).toBe(0);

    // Пассажиру создано уведомление о завершении.
    const notification = await db.notification.findFirst({
      where: { userId: users.passengerId, type: "trip_status_changed" },
    });
    expect(notification).not.toBeNull();
  });

  it("rejects complete of an already completed trip (400 TRIP_NOT_ACTIVE)", async () => {
    await app.request(`/api/v1/trips/${tripId}/complete?force=1`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    const second = await app.request(`/api/v1/trips/${tripId}/complete?force=1`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
    });

    expect(second.status).toBe(400);
    const body = await second.json();
    expect(body.code).toBe("TRIP_NOT_ACTIVE");
  });

  it("does not double-increment tripsCount when complete races with cancel", async () => {
    // Параллельные cancel и complete одной поездки: один должен пройти,
    // второй — 409 (Serializable conflict) или 400 (статус уже изменён).
    const [cancelRes, completeRes] = await Promise.all([
      app.request(`/api/v1/trips/${tripId}/cancel`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
      }),
      app.request(`/api/v1/trips/${tripId}/complete?force=1`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${devMockAccessToken(users.driverId)}` },
      }),
    ]);

    const statuses = [cancelRes.status, completeRes.status].sort();
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(statuses[1]).toBeLessThan(500);

    const driver = await db.user.findUnique({ where: { id: users.driverId } });
    // tripsCount начислен максимум один раз (только если прошёл complete).
    expect(driver?.tripsCount ?? 0).toBeLessThanOrEqual(1);
  });
});
