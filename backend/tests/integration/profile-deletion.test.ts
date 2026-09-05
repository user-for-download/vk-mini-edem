import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

describe("DELETE /api/v1/users/me", () => {
  let userId: string;
  let driverId: string;
  let tripId: string;

  beforeEach(async () => {
    const suffix = Date.now() + Math.floor(Math.random() * 1000);
    const [user, driver] = await Promise.all([
      db.user.create({ data: { name: `Delete user ${suffix}`, vkUserId: 6100000 + suffix % 100000, avatar: "", about: "about" } }),
      db.user.create({ data: { name: `Delete driver ${suffix}`, vkUserId: 6200000 + suffix % 100000, avatar: "" } }),
    ]);
    userId = user.id;
    driverId = driver.id;
    const trip = await db.trip.create({ data: { driverId, fromCity: "Москва", fromAddress: "A", toCity: "Тула", toAddress: "B", departureAt: new Date("2030-01-01T10:00:00Z"), durationMinutes: 120, distanceKm: 180, price: 700, seatsTotal: 3, seatsAvailable: 3, tags: [] } });
    tripId = trip.id;
    await db.car.create({ data: { userId, model: "Test", color: "Black", plate: "A000AA" } });
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { passengerId: userId } });
    await db.rideRequest.deleteMany({ where: { userId } });
    await db.trip.deleteMany({ where: { id: tripId } });
    await db.car.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: { in: [userId, driverId] } } });
  });

  it("anonymizes the account and invalidates required auth", async () => {
    const response = await app.request("/api/v1/users/me", { method: "DELETE", headers: { Authorization: `Bearer ${devMockAccessToken(userId)}` } });
    expect(response.status).toBe(200);
    const deleted = await db.user.findUnique({ where: { id: userId }, include: { car: true } });
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.vkUserId).not.toBeNull();
    expect(deleted?.name).toBe("Удалённый пользователь");
    expect(deleted?.car).toBeNull();
    const after = await app.request("/api/v1/users/me", { headers: { Authorization: `Bearer ${devMockAccessToken(userId)}` } });
    expect(after.status).toBe(403);
  });

  it("blocks deletion while the user has an active trip obligation", async () => {
    const ownTrip = await db.trip.create({ data: { driverId: userId, fromCity: "Москва", fromAddress: "A", toCity: "Тула", toAddress: "B", departureAt: new Date("2030-01-01T10:00:00Z"), durationMinutes: 120, distanceKm: 180, price: 700, seatsTotal: 3, seatsAvailable: 3, tags: [] } });
    try {
      const response = await app.request("/api/v1/users/me", { method: "DELETE", headers: { Authorization: `Bearer ${devMockAccessToken(userId)}` } });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("ACCOUNT_HAS_ACTIVE_OBLIGATIONS");
    } finally {
      await db.trip.delete({ where: { id: ownTrip.id } });
    }
  });
});
