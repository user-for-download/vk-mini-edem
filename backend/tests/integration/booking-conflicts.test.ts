import { beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";

/**
 * P2002-конфликты при бронировании: идемпотентный retry, SEAT_TAKEN,
 * ALREADY_BOOKED, гонка параллельных броней.
 *
 * Partial unique индексы (active_seat_booking, active_passenger_booking)
 * создаются SQL-миграцией — в тестовую БД (db push) они не попадают,
 * поэтому применяем их здесь идемпотентно (IF NOT EXISTS).
 *
 * Паттерны репо (см. smoke.test.ts): app.request() вместо supertest,
 * dev-авторизация Bearer mock-access-token-{userId}, уникальные vkUserId.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

describe("POST /api/v1/bookings — P2002 conflict handling", () => {
  // vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
  let vkSeq = 3_100_000;
  let driverId: string;
  let passenger1Id: string;
  let passenger2Id: string;
  let tripId: string;

  beforeAll(async () => {
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "active_seat_booking"
        ON "Booking"("tripId", "seat")
        WHERE "status" IN ('pending', 'confirmed')
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "active_passenger_booking"
        ON "Booking"("tripId", "passengerId")
        WHERE "status" IN ('pending', 'confirmed')
    `);
  });

  async function createUser(name: string): Promise<string> {
    const user = await db.user.create({
      data: {
        name: `${name}-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=9",
      },
    });
    return user.id;
  }

  beforeEach(async () => {
    driverId = await createUser("Driver");
    passenger1Id = await createUser("P1");
    passenger2Id = await createUser("P2");

    const trip = await db.trip.create({
      data: {
        driverId,
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "СПб",
        toAddress: "Невский 1",
        departureAt: new Date("2030-06-01T09:00:00Z"),
        durationMinutes: 420,
        distanceKm: 700,
        price: 2000,
        seatsTotal: 4,
        seatsAvailable: 4,
        tags: [],
      },
    });
    tripId = trip.id;
  });

  afterEach(async () => {
    await db.booking.deleteMany({ where: { tripId } });
    await db.trip.deleteMany({ where: { id: tripId } });
    await db.user.deleteMany({ where: { id: { in: [driverId, passenger1Id, passenger2Id] } } });
  });

  async function book(
    passengerId: string,
    seat: number
  ): Promise<{ status: number; body: any }> {
    const res = await app.request("/api/v1/bookings", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer mock-access-token-${passengerId}`,
      },
      body: JSON.stringify({ tripId, seat }),
    });
    return { status: res.status, body: await res.json() };
  }

  it("returns 200 with the existing booking on idempotent retry (same passenger, same seat)", async () => {
    // Бронь уже существует (первый запрос создал её, но клиент получил
    // таймаут и повторил запрос).
    const existing = await db.booking.create({
      data: { tripId, passengerId: passenger1Id, seat: 1, status: "pending" },
    });
    await db.trip.update({
      where: { id: tripId },
      data: { seatsAvailable: { decrement: 1 } },
    });

    const { status, body } = await book(passenger1Id, 1);

    expect(status).toBe(200);
    expect(body.id).toBe(existing.id);
    expect(body.seat).toBe(1);
    expect(body.status).toBe("pending");

    // Место не «съелось» повторно — бронь ровно одна.
    const count = await db.booking.count({
      where: { tripId, status: { in: ["pending", "confirmed"] } },
    });
    expect(count).toBe(1);
  });

  it("returns 409 SEAT_TAKEN when another passenger books the same seat", async () => {
    await db.booking.create({
      data: { tripId, passengerId: passenger1Id, seat: 1, status: "pending" },
    });
    await db.trip.update({
      where: { id: tripId },
      data: { seatsAvailable: { decrement: 1 } },
    });

    const { status, body } = await book(passenger2Id, 1);

    expect(status).toBe(409);
    expect(body.code).toBe("SEAT_TAKEN");
  });

  it("returns 409 ALREADY_BOOKED when the same passenger books a different seat", async () => {
    await db.booking.create({
      data: { tripId, passengerId: passenger1Id, seat: 1, status: "pending" },
    });
    await db.trip.update({
      where: { id: tripId },
      data: { seatsAvailable: { decrement: 1 } },
    });

    const { status, body } = await book(passenger1Id, 2);

    expect(status).toBe(409);
    expect(body.code).toBe("ALREADY_BOOKED");
  });

  it("allows re-booking a seat after the previous booking was cancelled (partial index)", async () => {
    await db.booking.create({
      data: { tripId, passengerId: passenger1Id, seat: 1, status: "pending" },
    });
    await db.trip.update({
      where: { id: tripId },
      data: { seatsAvailable: { decrement: 1 } },
    });
    // Бронь отменена — слот освобождается (partial unique игнорирует cancelled).
    await db.booking.updateMany({
      where: { tripId, passengerId: passenger1Id },
      data: { status: "cancelled" },
    });

    const { status } = await book(passenger1Id, 1);

    expect(status).toBe(201);
  });

  it("concurrent identical bookings: exactly one wins, loser gets 200 or 409, one active row", async () => {
    const [r1, r2] = await Promise.all([
      book(passenger1Id, 1),
      book(passenger1Id, 1),
    ]);

    // Победитель всегда 201; проигравший — 200 (P2002 → идемпотентный
    // возврат существующей брони) или 409 (P2034 Serializable conflict).
    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toContain(201);
    expect(statuses[1]).toBeGreaterThanOrEqual(200);
    expect(statuses[1]).toBeLessThan(500);

    const count = await db.booking.count({
      where: { tripId, status: { in: ["pending", "confirmed"] } },
    });
    expect(count).toBe(1);
  });

  it("partial unique index exists and reports fields on P2002 (DB level)", async () => {
    await db.booking.create({
      data: { tripId, passengerId: passenger1Id, seat: 1, status: "pending" },
    });

    await expect(
      db.booking.create({
        data: { tripId, passengerId: passenger2Id, seat: 1, status: "pending" },
      })
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      const e = error as Prisma.PrismaClientKnownRequestError;
      expect(e.code).toBe("P2002");
      // Prisma 5.22 для Postgres отдаёт только meta.target (поля индекса) —
      // по нему хендлер классифицирует конфликт.
      expect(e.meta?.target).toContain("seat");
      return true;
    });
  });
});
