import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";

/**
 * Cursor-based пагинация GET /bookings/trip/:tripId.
 *
 * Паттерны репо (см. smoke.test.ts): app.request() вместо supertest,
 * dev-авторизация Bearer mock-access-token-{userId}, уникальные vkUserId.
 */
describe("GET /bookings/trip/:tripId — cursor pagination", () => {
  let driverId: string;
  let tripId: string;
  const passengerIds: string[] = [];
  // vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
  let vkSeq = 1_600_000;

  beforeEach(async () => {
    const driver = await db.user.create({
      data: {
        name: `Driver-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=3",
      },
    });
    driverId = driver.id;

    const trip = await db.trip.create({
      data: {
        driverId,
        fromCity: "Moscow",
        fromAddress: "Center",
        toCity: "SPb",
        toAddress: "Station",
        departureAt: new Date(Date.now() + 86_400_000),
        durationMinutes: 120,
        distanceKm: 700,
        price: 1500,
        seatsTotal: 4,
        seatsAvailable: 0,
        tags: [],
      },
    });
    tripId = trip.id;

    // 15 заявок с убывающими createdAt.
    for (let i = 0; i < 15; i++) {
      const passenger = await db.user.create({
        data: {
          name: `Passenger-${i}-${Date.now()}`,
          vkUserId: ++vkSeq,
          avatar: "https://i.pravatar.cc/200?img=4",
        },
      });
      passengerIds.push(passenger.id);

      await db.booking.create({
        data: {
          tripId,
          passengerId: passenger.id,
          seat: (i % 4) + 1,
          status: "pending",
          createdAt: new Date(Date.now() - i * 1000),
        },
      });
    }
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { tripId } });
    await db.trip.deleteMany({ where: { id: tripId } });
    await db.user.deleteMany({ where: { id: { in: [driverId, ...passengerIds] } } });
    passengerIds.length = 0;
  });

  it("requires authentication", async () => {
    const res = await app.request(`/api/v1/bookings/trip/${tripId}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent trip", async () => {
    const fakeUuid = "22222222-2222-2222-2222-222222222222";
    const res = await app.request(`/api/v1/bookings/trip/${fakeUuid}`, {
      headers: { Authorization: `Bearer mock-access-token-${driverId}` },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-driver", async () => {
    const otherUser = await db.user.create({
      data: {
        name: `Other-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=5",
      },
    });

    try {
      const res = await app.request(`/api/v1/bookings/trip/${tripId}`, {
        headers: { Authorization: `Bearer mock-access-token-${otherUser.id}` },
      });
      expect(res.status).toBe(403);
    } finally {
      await db.user.deleteMany({ where: { id: otherUser.id } });
    }
  });

  it("returns first page with custom limit and hasMore", async () => {
    const res = await app.request(`/api/v1/bookings/trip/${tripId}?limit=5`, {
      headers: { Authorization: `Bearer mock-access-token-${driverId}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(5);
    expect(body.pagination.hasMore).toBe(true);
    expect(body.pagination.nextCursor).toBeDefined();
    expect(body.pagination.limit).toBe(5);
  });

  it("defaults limit to 50 and returns everything in one page", async () => {
    const res = await app.request(`/api/v1/bookings/trip/${tripId}`, {
      headers: { Authorization: `Bearer mock-access-token-${driverId}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(15);
    expect(body.pagination.hasMore).toBe(false);
    expect(body.pagination.nextCursor).toBeNull();
  });

  it("traverses pages via cursor without overlap", async () => {
    const page1 = await (
      await app.request(`/api/v1/bookings/trip/${tripId}?limit=10`, {
        headers: { Authorization: `Bearer mock-access-token-${driverId}` },
      })
    ).json();

    expect(page1.items).toHaveLength(10);
    expect(page1.pagination.hasMore).toBe(true);

    const page2 = await (
      await app.request(
        `/api/v1/bookings/trip/${tripId}?limit=10&cursor=${page1.pagination.nextCursor}`,
        { headers: { Authorization: `Bearer mock-access-token-${driverId}` } }
      )
    ).json();

    expect(page2.items).toHaveLength(5);
    expect(page2.pagination.hasMore).toBe(false);
    expect(page2.pagination.nextCursor).toBeNull();

    const page1Ids = new Set(page1.items.map((b: { id: string }) => b.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it("returns empty page with 200 for a valid-format expired cursor", async () => {
    const fakeUuid = "33333333-3333-3333-3333-333333333333";
    const res = await app.request(`/api/v1/bookings/trip/${tripId}?cursor=${fakeUuid}`, {
      headers: { Authorization: `Bearer mock-access-token-${driverId}` },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.pagination.hasMore).toBe(false);
  });

  it("rejects invalid cursor format with 400", async () => {
    const res = await app.request(`/api/v1/bookings/trip/${tripId}?cursor=bad`, {
      headers: { Authorization: `Bearer mock-access-token-${driverId}` },
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe("VALIDATION_FAILED");
  });
});
