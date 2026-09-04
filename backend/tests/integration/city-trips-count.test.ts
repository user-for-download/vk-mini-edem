import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN читается из env при импорте — задаём до импорта app.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-citycount";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { devMockAccessToken } = await import("../dev-mock-auth.js");

/**
 * F17: City.tripsCount — декремент при отмене, guard от отрицательных
 * значений, пересчёт.
 *
 * Семантика (cities/counters.ts): tripsCount = число НЕ отменённых поездок,
 * ссылающихся на город через FK (fromCityId/toCityId). Создание
 * инкрементирует, отмена — декрементирует (guarded: tripsCount > 0),
 * завершение не меняет. Поездки без FK (legacy/сид) не считаются.
 *
 * Паттерны репо (см. trip-city-id.test.ts, admin-cities.test.ts):
 * app.request(), dev-mock-авторизация водителя, логин админа cookie,
 * уникальные имена городов с суффиксом файла.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-citycount";
const CITY_SUFFIX = "citycount";

function extractAdminCookie(response: Response): string | null {
  const setCookieHeader = response.headers.get("set-cookie");
  if (!setCookieHeader) return null;
  const match = /edem_admin_jwt=([^;]+)/.exec(setCookieHeader);
  return match ? match[1] : null;
}

async function loginAndGetCookie(): Promise<string> {
  const response = await app.request("/api/v1/admin/auth/login", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ token: ADMIN_TOKEN }),
  });
  const cookie = extractAdminCookie(response);
  if (!cookie) throw new Error("login did not set admin cookie");
  return cookie;
}

async function adminRequest(
  path: string,
  init: RequestInit,
  cookie: string,
): Promise<Response> {
  return app.request(`/api/v1/admin${path}`, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      Cookie: `edem_admin_jwt=${cookie}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
let vkSeq = 9_400_000;

async function createUserWithCar(): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `CityCountDriver-${++vkSeq}`,
      vkUserId: vkSeq,
      avatar: "https://i.pravatar.cc/200?img=5",
    },
  });
  await db.car.create({
    data: {
      userId: user.id,
      model: "Test",
      color: "white",
      plate: `CC${vkSeq}`,
    },
  });
  return user.id;
}

async function createCity(name: string): Promise<string> {
  const city = await db.city.create({
    data: { name, nameNormalized: name.trim().toLowerCase() },
  });
  return city.id;
}

async function cityCount(id: string): Promise<number> {
  const city = await db.city.findUnique({
    where: { id },
    select: { tripsCount: true },
  });
  // -1: города нет (ошибка в данных теста — очевидный провал ассертов).
  return city ? city.tripsCount : -1;
}

/** Поездка через API (с FK на города) — как в production. */
async function createApiTrip(
  driverId: string,
  fromCityId: string,
  toCityId: string,
  day = 1,
): Promise<string> {
  const res = await app.request("/api/v1/trips", {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${devMockAccessToken(driverId)}`,
    },
    body: JSON.stringify({
      fromCity: "Заполнится Откуда",
      fromAddress: "ул. Тестовая 1",
      toCity: "Заполнится Куда",
      toAddress: "ул. Тестовая 2",
      fromCityId,
      toCityId,
      // Разные дни: у одного водителя не может быть пересекающихся
      // активных поездок (проверка overlap при создании).
      departureAt: `2030-09-${String(day).padStart(2, "0")}T10:00:00Z`,
      durationMinutes: 120,
      distanceKm: 150,
      price: 500,
      seatsTotal: 3,
      tags: [],
    }),
  });
  if (res.status !== 201) {
    throw new Error(`Ожидался 201 при создании поездки, получен ${res.status}`);
  }
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function cancelTrip(driverId: string, tripId: string): Promise<Response> {
  return app.request(`/api/v1/trips/${tripId}/cancel`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${devMockAccessToken(driverId)}` },
  });
}

describe("F17 City.tripsCount: decrement + guard + recompute", () => {
  let cookie: string;
  let driverId: string;
  let cityAId: string;
  let cityBId: string;
  const tripIds: string[] = [];

  beforeAll(async () => {
    // Hermetic: тестовая БД поднимается через db push (без миграций),
    // поэтому CHECK из 20260904150000 на ней может отсутствовать —
    // создаём его идемпотентно до проверки.
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "City" ADD CONSTRAINT "City_tripsCount_nonnegative" CHECK ("tripsCount" >= 0);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  });

  beforeEach(async () => {
    // Защита от осколков упавшего прогона (суффикс уникален для файла).
    await db.city.deleteMany({
      where: { nameNormalized: { endsWith: CITY_SUFFIX } },
    });
    cookie = await loginAndGetCookie();
    driverId = await createUserWithCar();
    cityAId = await createCity(`Заречье-${CITY_SUFFIX}`);
    cityBId = await createCity(`Приозерск-${CITY_SUFFIX}`);
  });

  afterEach(async () => {
    if (tripIds.length > 0) {
      await db.booking.deleteMany({ where: { tripId: { in: tripIds } } });
      await db.trip.deleteMany({ where: { id: { in: tripIds } } });
      tripIds.length = 0;
    }
    await db.car.deleteMany({ where: { userId: driverId } });
    await db.user.deleteMany({ where: { id: driverId } });
    await db.city.deleteMany({ where: { id: { in: [cityAId, cityBId] } } });
  });

  it("создание инкрементирует, отмена декрементирует счётчики (before/after)", async () => {
    const beforeA = await cityCount(cityAId);
    const beforeB = await cityCount(cityBId);
    expect(beforeA).toBe(0);
    expect(beforeB).toBe(0);

    const tripId = await createApiTrip(driverId, cityAId, cityBId);
    tripIds.push(tripId);

    expect(await cityCount(cityAId)).toBe(beforeA + 1);
    expect(await cityCount(cityBId)).toBe(beforeB + 1);

    const res = await cancelTrip(driverId, tripId);
    expect(res.status).toBe(200);

    expect(await cityCount(cityAId)).toBe(beforeA);
    expect(await cityCount(cityBId)).toBe(beforeB);
  });

  it("завершение поездки не меняет счётчики (счёт = не отменённые поездки)", async () => {
    const tripId = await createApiTrip(driverId, cityAId, cityBId);
    tripIds.push(tripId);

    const res = await app.request(`/api/v1/trips/${tripId}/complete?force=1`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${devMockAccessToken(driverId)}` },
    });
    expect(res.status).toBe(200);

    expect(await cityCount(cityAId)).toBe(1);
    expect(await cityCount(cityBId)).toBe(1);
  });

  it("декремент не уводит счётчик в минус (guarded updateMany)", async () => {
    const tripId = await createApiTrip(driverId, cityAId, cityBId);
    tripIds.push(tripId);

    // Дрейфованные (заниженные вручную) данные: счётчик ниже реального.
    await db.city.update({ where: { id: cityAId }, data: { tripsCount: 0 } });

    const res = await cancelTrip(driverId, tripId);
    expect(res.status).toBe(200);

    expect(await cityCount(cityAId)).toBe(0);
    // Второй город со «правильным» счётчиком декрементируется штатно.
    expect(await cityCount(cityBId)).toBe(0);
  });

  it("DB CHECK: tripsCount < 0 запрещено", async () => {
    await expect(
      db.$executeRaw`UPDATE "City" SET "tripsCount" = -1 WHERE "id" = ${cityAId}`
    ).rejects.toThrow();

    // Счётчик не изменился.
    expect(await cityCount(cityAId)).toBe(0);
  });

  it("recompute чинит дрейф и поездки, удалённые в обход API", async () => {
    const t1 = await createApiTrip(driverId, cityAId, cityBId, 1);
    const t2 = await createApiTrip(driverId, cityBId, cityAId, 2);
    const t3 = await createApiTrip(driverId, cityAId, cityBId, 3);
    tripIds.push(t1, t2, t3);

    // t1: A→B, t2: B→A, t3: A→B
    expect(await cityCount(cityAId)).toBe(3); // t1 from, t2 to, t3 from
    expect(await cityCount(cityBId)).toBe(3); // t1 to, t2 from, t3 to

    const cancel = await cancelTrip(driverId, t2);
    expect(cancel.status).toBe(200);
    expect(await cityCount(cityAId)).toBe(2);
    expect(await cityCount(cityBId)).toBe(2);

    // Прямое удаление поездки в обход API — счётчик устарел.
    await db.trip.delete({ where: { id: t3 } });
    tripIds.splice(tripIds.indexOf(t3), 1);

    // Ручной дрейф счётчиков.
    await db.city.update({ where: { id: cityAId }, data: { tripsCount: 99 } });
    await db.city.update({ where: { id: cityBId }, data: { tripsCount: 0 } });

    // Без админ-сессии — 401.
    const unauth = await app.request("/api/v1/admin/cities/recompute-trips-count", {
      method: "POST",
    });
    expect(unauth.status).toBe(401);

    const res = await adminRequest(
      "/cities/recompute-trips-count",
      { method: "POST" },
      cookie
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; updated: number };
    expect(body.ok).toBe(true);
    expect(body.updated).toBeGreaterThanOrEqual(2);

    // Ground truth: не отменена и не удалена только t1 (A→B).
    expect(await cityCount(cityAId)).toBe(1);
    expect(await cityCount(cityBId)).toBe(1);
  });

  it("recompute не считает поездки без FK (legacy/сид)", async () => {
    const tripId = await createApiTrip(driverId, cityAId, cityBId);
    tripIds.push(tripId);

    // Сидовая/legacy-поездка: без FK на города.
    const legacy = await db.trip.create({
      data: {
        driverId,
        fromCity: "Москва",
        fromAddress: "м. Тёплый Стан",
        toCity: "Тула",
        toAddress: "пр-т Ленина",
        fromCityId: null,
        toCityId: null,
        departureAt: new Date("2030-10-01T09:00:00Z"),
        durationMinutes: 120,
        distanceKm: 180,
        price: 700,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
      },
    });
    tripIds.push(legacy.id);

    const res = await adminRequest(
      "/cities/recompute-trips-count",
      { method: "POST" },
      cookie
    );
    expect(res.status).toBe(200);

    // Поездка без FK не учитывается — счётчики не изменились.
    expect(await cityCount(cityAId)).toBe(1);
    expect(await cityCount(cityBId)).toBe(1);
  });
});
