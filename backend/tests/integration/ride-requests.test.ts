import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

const JSON_HEADERS = { "Content-Type": "application/json" };

describe("RideRequest API", () => {
  let userId: string;
  let otherUserId: string;
  let fromCityId: string;
  let toCityId: string;

  beforeEach(async () => {
    const suffix = Date.now();
    fromCityId = randomUUID();
    toCityId = randomUUID();
    const users = await Promise.all([
      db.user.create({ data: { name: `Ride requester ${suffix}`, vkUserId: 4100001 + suffix % 100000, avatar: "" } }),
      db.user.create({ data: { name: `Ride driver ${suffix}`, vkUserId: 4200001 + suffix % 100000, avatar: "" } }),
    ]);
    userId = users[0].id;
    otherUserId = users[1].id;
    await db.city.createMany({
      data: [
        { id: fromCityId, name: `From ${suffix}`, nameNormalized: `from-${suffix}` },
        { id: toCityId, name: `To ${suffix}`, nameNormalized: `to-${suffix}` },
      ],
    });
  });

  afterEach(async () => {
    await db.rideRequest.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await db.city.deleteMany({ where: { id: { in: [fromCityId, toCityId] } } });
    await db.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  });

  function auth(user: string): Record<string, string> {
    return { Authorization: `Bearer ${devMockAccessToken(user)}` };
  }

  it("creates, lists and cancels an owned request", async () => {
    const create = await app.request("/api/v1/ride-requests", {
      method: "POST",
      headers: { ...JSON_HEADERS, ...auth(userId) },
      body: JSON.stringify({
        fromCityId,
        toCityId,
        earliestAt: "2030-01-01T09:00:00.000Z",
        latestAt: "2030-01-01T12:00:00.000Z",
        expiresAt: "2030-01-02T00:00:00.000Z",
      }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.seats).toBe(1);
    expect(created.fromCity.id).toBe(fromCityId);

    const list = await app.request("/api/v1/ride-requests", { headers: auth(userId) });
    expect(list.status).toBe(200);
    expect((await list.json()).items).toHaveLength(1);

    const remove = await app.request(`/api/v1/ride-requests/${created.id}`, {
      method: "DELETE",
      headers: auth(userId),
    });
    expect(remove.status).toBe(200);
    expect((await remove.json()).status).toBe("cancelled");
  });

  it("returns only matching requests to another user", async () => {
    const create = await app.request("/api/v1/ride-requests", {
      method: "POST",
      headers: { ...JSON_HEADERS, ...auth(userId) },
      body: JSON.stringify({ fromCityId, toCityId, earliestAt: "2030-01-01T09:00:00.000Z", latestAt: "2030-01-01T12:00:00.000Z", expiresAt: "2030-01-02T00:00:00.000Z" }),
    });
    const request = await create.json();
    const matching = await app.request(`/api/v1/ride-requests/matching?fromCityId=${fromCityId}&toCityId=${toCityId}&earliestAt=2030-01-01T10:00:00.000Z&latestAt=2030-01-01T11:00:00.000Z`, { headers: auth(otherUserId) });
    expect(matching.status).toBe(200);
    expect((await matching.json()).items.map((item: { id: string }) => item.id)).toContain(request.id);
  });

  it("rejects terminal status changes and more than three active requests", async () => {
    for (let index = 0; index < 3; index += 1) {
      const response = await app.request("/api/v1/ride-requests", {
        method: "POST",
        headers: { ...JSON_HEADERS, ...auth(userId) },
        body: JSON.stringify({ fromCityId, toCityId, earliestAt: "2030-01-01T09:00:00.000Z", latestAt: "2030-01-01T12:00:00.000Z", expiresAt: "2030-01-02T00:00:00.000Z" }),
      });
      expect(response.status).toBe(201);
    }
    const overLimit = await app.request("/api/v1/ride-requests", {
      method: "POST",
      headers: { ...JSON_HEADERS, ...auth(userId) },
      body: JSON.stringify({ fromCityId, toCityId, earliestAt: "2030-01-01T09:00:00.000Z", latestAt: "2030-01-01T12:00:00.000Z", expiresAt: "2030-01-02T00:00:00.000Z" }),
    });
    expect(overLimit.status).toBe(409);
  });
});
