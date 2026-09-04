import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN читается из env при импорте — задаём до импорта app.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-tripcity";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { devMockAccessToken } = await import("../dev-mock-auth.js");

/**
 * Интеграция справочника городов с созданием/редактированием поездки:
 *  - fromCityId/toCityId обязательны на уровне DTO;
 *  - сервер резолвит id → name и сохраняет снимок fromCity/toCity;
 *  - tripsCount инкрементируется при создании и переносе поездки.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

async function ensureCity(name: string): Promise<string> {
  const nameNormalized = name.trim().toLowerCase();
  const existing = await db.city.findFirst({ where: { nameNormalized } });
  if (existing) return existing.id;
  const created = await db.city.create({ data: { name, nameNormalized } });
  return created.id;
}

async function createUserWithCar(name: string): Promise<string> {
  const seq = Math.floor(Math.random() * 1_000_000) + 8_000_000;
  const user = await db.user.create({
    data: {
      name: `${name}-${seq}`,
      vkUserId: seq,
      avatar: "https://i.pravatar.cc/200?img=1",
    },
  });
  await db.car.create({
    data: { userId: user.id, model: "Test", color: "white", plate: `TT${seq}` },
  });
  return user.id;
}

describe("Trip ↔ city directory integration", () => {
  let driverId: string;
  let fromCityId: string;
  let toCityId: string;

  beforeEach(async () => {
    driverId = await createUserWithCar("driver");
    fromCityId = await ensureCity("Москва-testcityid");
    toCityId = await ensureCity("Тула-testcityid");
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { trip: { driverId } } });
    await db.review.deleteMany({ where: { trip: { driverId } } });
    await db.trip.deleteMany({ where: { driverId } });
    await db.car.deleteMany({ where: { userId: driverId } });
    await db.user.deleteMany({ where: { id: driverId } });
  });

  it("rejects create without fromCityId (DTO 400)", async () => {
    const res = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects create with unknown fromCityId (CITY_NOT_FOUND 400)", async () => {
    const fake = "00000000-0000-4000-8000-000000000000";
    const res = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId: fake,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Город отправления/);
  });

  it("rejects create where fromCityId === toCityId", async () => {
    const res = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Москва",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId: fromCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("creates trip with valid cityIds; fromCity/toCity snapshots are resolved names", async () => {
    const res = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "ЛЮБАЯ-СТРОКА", // сервер должен перезаписать
        fromAddress: "Тверская 1",
        toCity: "ЛЮБАЯ-СТРОКА-2",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.fromCity).toBe("Москва-testcityid");
    expect(body.toCity).toBe("Тула-testcityid");

    // tripsCount инкрементирован
    const fromCity = await db.city.findUnique({ where: { id: fromCityId } });
    const toCity = await db.city.findUnique({ where: { id: toCityId } });
    expect(fromCity?.tripsCount).toBeGreaterThanOrEqual(1);
    expect(toCity?.tripsCount).toBeGreaterThanOrEqual(1);
  });

  it("rejects PATCH that tries to change route (fromCityId 400)", async () => {
    const create = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    const tripId = (await create.json()).id;

    const newFromId = await ensureCity("Рязань-testcityid");

    const update = await app.request(`/api/v1/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({ fromCityId: newFromId }),
    });
    expect(update.status).toBe(400);
  });

  it("rejects PATCH that tries to change route (toCityId 400)", async () => {
    const create = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    const tripId = (await create.json()).id;

    const newToId = await ensureCity("Рязань-testcityid");

    const update = await app.request(`/api/v1/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({ toCityId: newToId }),
    });
    expect(update.status).toBe(400);
  });

  it("rejects PATCH that tries to change route (fromCity string 400)", async () => {
    const create = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    const tripId = (await create.json()).id;

    const update = await app.request(`/api/v1/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({ fromCity: "Рязань", toCity: "Калуга" }),
    });
    expect(update.status).toBe(400);
  });

  it("allows PATCH of non-route fields (price only)", async () => {
    const create = await app.request("/api/v1/trips", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId,
        toCityId,
        departureAt: "2030-08-01T10:00:00Z",
        durationMinutes: 130,
        distanceKm: 165,
        price: 500,
        seatsTotal: 3,
        tags: [],
      }),
    });
    const tripId = (await create.json()).id;

    const update = await app.request(`/api/v1/trips/${tripId}`, {
      method: "PATCH",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${devMockAccessToken(driverId)}`,
      },
      body: JSON.stringify({ price: 700 }),
    });
    expect(update.status).toBe(200);
    const updated = await update.json();
    expect(updated.price).toBe(700);
    // Маршрут не изменился.
    expect(updated.fromCityId).toBe(fromCityId);
    expect(updated.toCityId).toBe(toCityId);
    expect(updated.fromCity).toBe("Москва-testcityid");
    expect(updated.toCity).toBe("Тула-testcityid");
  });
});
