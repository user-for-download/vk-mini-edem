import { afterEach, describe, expect, it } from "vitest";

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { signAccessToken } = await import("../../src/auth/tokens.js");

/**
 * DELETE /api/v1/users/me/car (tg-migration-13).
 *
 * Инвариант trips-creation (trips/index.ts: создание поездки требует car,
 * иначе NO_CAR): водитель с active-поездками без машины — неконсистентное
 * состояние, поэтому удаление при active-поездках блокируется 409
 * ACCOUNT_HAS_ACTIVE_OBLIGATIONS (зеркально DELETE /users/me). История
 * (completed/cancelled) и брони пассажира удалению не мешают.
 * Account-safe: requireUser (401/403 tombstone/ban), удаляется только свой
 * car (чужие недоступны по построению), лимитер profileUpdateLimiter.
 *
 * Паттерны репо: app.request(), signAccessToken, уникальные telegramUserId
 * (INT4-диапазон 9_940_000+ — не пересекается с другими сьютами),
 * поездки напрямую в БД (формат telegram-profile.test.ts), чистка в afterEach.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const CAR_URL = "/api/v1/users/me/car";

const createdUserIds: string[] = [];
const createdTripIds: string[] = [];
const createdBookingIds: string[] = [];
let tgSeq = 9_940_000n;

async function seedUser(
  data: Record<string, unknown> = {},
): Promise<{ id: string; token: string }> {
  const telegramUserId = ++tgSeq;
  const user = await db.user.create({
    data: {
      telegramUserId,
      name: `CarDelete-${telegramUserId}`,
      avatar: "https://i.pravatar.cc/200?img=11",
      ...data,
    },
  });
  createdUserIds.push(user.id);
  return { id: user.id, token: await signAccessToken(user.id) };
}

async function seedCar(userId: string, plate: string | null = "583") {
  return db.car.create({
    data: { userId, model: "Lada", color: "белый", plate },
  });
}

async function seedActiveTrip(driverId: string): Promise<string> {
  const trip = await db.trip.create({
    data: {
      driverId,
      fromCity: "Москва",
      fromAddress: "A",
      toCity: "Тула",
      toAddress: "B",
      departureAt: new Date("2030-01-01T10:00:00Z"),
      durationMinutes: 120,
      distanceKm: 180,
      price: 700,
      seatsTotal: 3,
      seatsAvailable: 3,
      tags: [],
    },
  });
  createdTripIds.push(trip.id);
  return trip.id;
}

function deleteCar(token: string | null) {
  return app.request(CAR_URL, {
    method: "DELETE",
    headers: {
      ...JSON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

afterEach(async () => {
  if (createdBookingIds.length > 0) {
    await db.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    createdBookingIds.length = 0;
  }
  if (createdTripIds.length > 0) {
    await db.trip.deleteMany({ where: { id: { in: createdTripIds } } });
    createdTripIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await db.car.deleteMany({ where: { userId: { in: createdUserIds } } });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("DELETE /users/me/car: happy path", () => {
  it("удаляет своё авто (200, car отсутствует в ответе и в БД)", async () => {
    // Arrange
    const { id, token } = await seedUser();
    await seedCar(id);

    // Act
    const res = await deleteCar(token);

    // Assert — ответ как upsertCar (serializeUser без car).
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; car?: unknown };
    expect(body.id).toBe(id);
    expect(body).not.toHaveProperty("car");
    expect(await db.car.findUnique({ where: { userId: id } })).toBeNull();
  });

  it("повторное удаление → 404 NOT_FOUND Car not found", async () => {
    // Arrange
    const { id, token } = await seedUser();
    await seedCar(id);

    // Act
    expect((await deleteCar(token)).status).toBe(200);
    const second = await deleteCar(token);

    // Assert
    expect(second.status).toBe(404);
    expect(((await second.json()) as { code: string }).code).toBe("NOT_FOUND");
    expect(await db.car.findUnique({ where: { userId: id } })).toBeNull();
  });

  it("без авто сразу → 404, ничего не создаётся", async () => {
    const { id, token } = await seedUser();

    const res = await deleteCar(token);

    expect(res.status).toBe(404);
    expect(((await res.json()) as { message: string }).message).toBe(
      "Car not found",
    );
    expect(await db.car.findUnique({ where: { userId: id } })).toBeNull();
  });
});

describe("DELETE /users/me/car: инвариант активных обязательств", () => {
  it("409 при active-поездке водителя, авто intact", async () => {
    const { id, token } = await seedUser();
    await seedCar(id);
    await seedActiveTrip(id);

    const res = await deleteCar(token);

    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(
      "ACCOUNT_HAS_ACTIVE_OBLIGATIONS",
    );
    expect(await db.car.findUnique({ where: { userId: id } })).not.toBeNull();
  });

  it("completed-поездка — история: удаление разрешено", async () => {
    const { id, token } = await seedUser();
    await seedCar(id);
    const tripId = await seedActiveTrip(id);
    await db.trip.update({
      where: { id: tripId },
      data: { status: "completed" },
    });

    const res = await deleteCar(token);

    expect(res.status).toBe(200);
    expect(await db.car.findUnique({ where: { userId: id } })).toBeNull();
  });

  it("cancelled-поездка — история: удаление разрешено", async () => {
    const { id, token } = await seedUser();
    await seedCar(id);
    const tripId = await seedActiveTrip(id);
    await db.trip.update({
      where: { id: tripId },
      data: { status: "cancelled" },
    });

    const res = await deleteCar(token);

    expect(res.status).toBe(200);
    expect(await db.car.findUnique({ where: { userId: id } })).toBeNull();
  });

  it("активная бронь пассажира на чужой active-поездке удалению не мешает", async () => {
    // Arrange — пассажир без обязательств водителя (авто нужно только водителю).
    const { id: passengerId, token } = await seedUser();
    const { id: driverId } = await seedUser();
    await seedCar(passengerId);
    const tripId = await seedActiveTrip(driverId);
    const booking = await db.booking.create({
      data: { tripId, passengerId, seat: 1, status: "confirmed" },
    });
    createdBookingIds.push(booking.id);

    // Act
    const res = await deleteCar(token);

    // Assert
    expect(res.status).toBe(200);
    expect(await db.car.findUnique({ where: { userId: passengerId } })).toBeNull();
  });
});

describe("DELETE /users/me/car: account-safe identity", () => {
  it("без токена → 401", async () => {
    expect((await deleteCar(null)).status).toBe(401);
  });

  it("забаненному → 403, авто intact", async () => {
    const { id, token } = await seedUser({
      bannedAt: new Date(),
      banReason: "Спам",
    });
    await seedCar(id);

    const res = await deleteCar(token);

    expect(res.status).toBe(403);
    expect(await db.car.findUnique({ where: { userId: id } })).not.toBeNull();
  });

  it("удалённому → 403, авто intact", async () => {
    const { id, token } = await seedUser({ deletedAt: new Date() });
    await seedCar(id);

    const res = await deleteCar(token);

    expect(res.status).toBe(403);
    expect(await db.car.findUnique({ where: { userId: id } })).not.toBeNull();
  });

  it("кросс-доступ невозможен: удаление трогает только свой car", async () => {
    // Arrange — оба с авто.
    const { id: userA, token: tokenA } = await seedUser();
    const { id: userB } = await seedUser();
    await seedCar(userA);
    await seedCar(userB);

    // Act — A удаляет своё.
    const res = await deleteCar(tokenA);

    // Assert — авто B intact.
    expect(res.status).toBe(200);
    expect(await db.car.findUnique({ where: { userId: userA } })).toBeNull();
    expect(await db.car.findUnique({ where: { userId: userB } })).not.toBeNull();
  });
});
