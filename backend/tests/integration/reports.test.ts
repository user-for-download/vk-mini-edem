import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

const headers = (userId: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${devMockAccessToken(userId)}`,
});

describe("Reports API", () => {
  let driverId: string;
  let passengerId: string;
  let tripId: string;
  let bookingId: string;

  beforeEach(async () => {
    const users = await Promise.all([
      db.user.create({ data: { name: `Report driver ${Date.now()}`, vkUserId: 5100000 + Math.floor(Math.random() * 100000), avatar: "" } }),
      db.user.create({ data: { name: `Report passenger ${Date.now()}`, vkUserId: 5200000 + Math.floor(Math.random() * 100000), avatar: "" } }),
    ]);
    [driverId, passengerId] = users.map((user) => user.id);
    const trip = await db.trip.create({ data: { driverId, fromCity: "Москва", fromAddress: "Адрес 1", toCity: "Тула", toAddress: "Адрес 2", departureAt: new Date("2030-01-01T10:00:00Z"), durationMinutes: 120, distanceKm: 180, price: 700, seatsTotal: 3, seatsAvailable: 2, tags: [] } });
    tripId = trip.id;
    const booking = await db.booking.create({ data: { tripId, passengerId, seat: 1, status: "confirmed" } });
    bookingId = booking.id;
  });

  afterEach(async () => {
    await db.report.deleteMany({ where: { reporterId: { in: [driverId, passengerId] } } });
    await db.booking.deleteMany({ where: { id: bookingId } });
    await db.trip.deleteMany({ where: { id: tripId } });
    await db.user.deleteMany({ where: { id: { in: [driverId, passengerId] } } });
  });

  it("creates and lists a report only for a related user", async () => {
    const create = await app.request("/api/v1/reports", { method: "POST", headers: headers(passengerId), body: JSON.stringify({ targetType: "user", targetId: driverId, category: "safety", description: "  Небезопасное поведение  " }) });
    expect(create.status).toBe(201);
    expect((await create.json()).description).toBe("Небезопасное поведение");
    const list = await app.request("/api/v1/reports", { headers: headers(passengerId) });
    expect((await list.json())).toHaveLength(1);
  });

  it("rejects self reports and duplicate open reports", async () => {
    const self = await app.request("/api/v1/reports", { method: "POST", headers: headers(passengerId), body: JSON.stringify({ targetType: "user", targetId: passengerId, category: "spam", description: "Сам на себя" }) });
    expect(self.status).toBe(403);
    const payload = { targetType: "booking", targetId: bookingId, category: "fraud", description: "Подозрительная бронь" };
    expect((await app.request("/api/v1/reports", { method: "POST", headers: headers(passengerId), body: JSON.stringify(payload) })).status).toBe(201);
    expect((await app.request("/api/v1/reports", { method: "POST", headers: headers(passengerId), body: JSON.stringify(payload) })).status).toBe(409);
  });

  it("rejects a report from an unrelated user", async () => {
    const unrelated = await db.user.create({ data: { name: "Unrelated", vkUserId: 5300000 + Math.floor(Math.random() * 100000), avatar: "" } });
    try {
      const response = await app.request("/api/v1/reports", { method: "POST", headers: headers(unrelated.id), body: JSON.stringify({ targetType: "trip", targetId: tripId, category: "spam", description: "Не связан с поездкой" }) });
      expect(response.status).toBe(403);
    } finally {
      await db.user.delete({ where: { id: unrelated.id } });
    }
  });
});
