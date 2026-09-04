import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";

/**
 * Дозированная выдача vkUserId для кнопки «Написать» (ЛС ВКонтакте).
 *
 * Приватность: vkUserId видят только участники активной брони —
 * по аналогии с точными адресами встречи (includePrivateDetails).
 * В публичные выдачи (поиск поездок, /bookings/history) поле не попадает.
 *
 * Сценарии:
 * - GET /trips/:id      → driver.vkUserId (водителю и пассажиру с активной бронью);
 * - GET /bookings/my    → driver.vkUserId (свои брони пассажира);
 * - GET /bookings/trip/:tripId → passenger.vkUserId (водителю его поездки).
 *
 * Паттерны репо (см. smoke.test.ts): app.request() вместо supertest,
 * dev-авторизация Bearer mock-access-token-{userId}, уникальные vkUserId.
 */
describe("vkUserId disclosure for VK DM link", () => {
  let driverId: string;
  let driverVkUserId: number;
  let tripId: string;
  const createdUserIds: string[] = [];
  // vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
  let vkSeq = 1_800_000;

  const auth = (userId: string) => ({
    Authorization: `Bearer mock-access-token-${userId}`,
  });

  const createTripForDriver = async () => {
    driverVkUserId = ++vkSeq;
    const driver = await db.user.create({
      data: {
        name: `VkDmDriver-${Date.now()}`,
        vkUserId: driverVkUserId,
        avatar: "https://i.pravatar.cc/200?img=3",
      },
    });
    driverId = driver.id;
    createdUserIds.push(driver.id);

    const trip = await db.trip.create({
      data: {
        driverId,
        fromCity: "Москва",
        fromAddress: "м. Тёплый Стан, выход 4",
        toCity: "Тула",
        toAddress: "Торговый центр на пр. Ленина",
        departureAt: new Date(Date.now() + 86_400_000),
        durationMinutes: 180,
        distanceKm: 180,
        price: 800,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
      },
    });
    tripId = trip.id;
  };

  const createUser = async (name: string) => {
    const user = await db.user.create({
      data: {
        name: `${name}-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=5",
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  const getTripDetails = async (userId?: string) => {
    const res = await app.request(`/api/v1/trips/${tripId}`, {
      headers: userId ? auth(userId) : {},
    });
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeEach(async () => {
    await createTripForDriver();
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { tripId } });
    await db.trip.deleteMany({ where: { id: tripId } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  });

  describe("GET /trips/:id — driver.vkUserId", () => {
    it("driver sees own vkUserId", async () => {
      const body = await getTripDetails(driverId);
      expect(body.driver.vkUserId).toBe(driverVkUserId);
    });

    it("unauthenticated requester gets no driver vkUserId", async () => {
      const body = await getTripDetails();
      expect(body.driver.vkUserId).toBeUndefined();
    });

    it("authenticated stranger without booking gets no driver vkUserId", async () => {
      const stranger = await createUser("Stranger");
      const body = await getTripDetails(stranger.id);
      expect(body.driver.vkUserId).toBeUndefined();
    });

    it("passenger with pending booking sees driver vkUserId", async () => {
      const passenger = await createUser("PendingPassenger");
      await db.booking.create({
        data: { tripId, passengerId: passenger.id, seat: 1, status: "pending" },
      });
      const body = await getTripDetails(passenger.id);
      expect(body.driver.vkUserId).toBe(driverVkUserId);
    });

    it("passenger with confirmed booking sees driver vkUserId", async () => {
      const passenger = await createUser("ConfirmedPassenger");
      await db.booking.create({
        data: { tripId, passengerId: passenger.id, seat: 2, status: "confirmed" },
      });
      const body = await getTripDetails(passenger.id);
      expect(body.driver.vkUserId).toBe(driverVkUserId);
    });

    it("passenger with cancelled booking gets no driver vkUserId", async () => {
      const passenger = await createUser("CancelledPassenger");
      await db.booking.create({
        data: { tripId, passengerId: passenger.id, seat: 3, status: "cancelled" },
      });
      const body = await getTripDetails(passenger.id);
      expect(body.driver.vkUserId).toBeUndefined();
    });

    it("public trips list never exposes driver vkUserId", async () => {
      const res = await app.request("/api/v1/trips?limit=50");
      expect(res.status).toBe(200);
      const body = await res.json();
      const listed = body.items.find((t: { id: string }) => t.id === tripId);
      expect(listed).toBeDefined();
      expect(listed.driver.vkUserId).toBeUndefined();
    });
  });

  describe("GET /bookings/my — driver.vkUserId", () => {
    it("passenger sees driver vkUserId in own active booking", async () => {
      const passenger = await createUser("MyBookingPassenger");
      await db.booking.create({
        data: { tripId, passengerId: passenger.id, seat: 1, status: "confirmed" },
      });

      const res = await app.request("/api/v1/bookings/my", {
        headers: auth(passenger.id),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const mine = body.find((b: { trip: { id: string } }) => b.trip.id === tripId);
      expect(mine).toBeDefined();
      expect(mine.trip.driver.vkUserId).toBe(driverVkUserId);
    });
  });

  describe("GET /bookings/trip/:tripId — passenger.vkUserId", () => {
    it("driver sees passenger vkUserId in trip requests", async () => {
      const passenger = await createUser("RequestedPassenger");
      await db.booking.create({
        data: { tripId, passengerId: passenger.id, seat: 1, status: "pending" },
      });

      const res = await app.request(`/api/v1/bookings/trip/${tripId}`, {
        headers: auth(driverId),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      const request = body.items.find(
        (b: { passenger: { id: string } }) => b.passenger.id === passenger.id
      );
      expect(request).toBeDefined();
      expect(request.passenger.vkUserId).toBe(passenger.vkUserId);
    });

    it("non-driver is rejected and gets no passenger data", async () => {
      const stranger = await createUser("Stranger");
      const res = await app.request(`/api/v1/bookings/trip/${tripId}`, {
        headers: auth(stranger.id),
      });
      expect(res.status).toBe(403);
    });
  });
});
