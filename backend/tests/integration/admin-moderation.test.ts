import { afterEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN и лимиты логина читаются из env при старте/импорте.
// Задаём до импорта app; лимит завышаем, чтобы тест не упёрся в 429.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-123";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");

/**
 * Регрессия модераторских операций админки:
 *
 * 1) PATCH /admin/trips/:id/cancel — до исправления завершённую поездку
 *    можно было отменить задним числом. Теперь completed/cancelled → 409
 *    TRIP_NOT_ACTIVE (решение 2).
 *
 * 2) DELETE /admin/reviews/:id — до исправления удаление отзыва не
 *    пересчитывало рейтинговый агрегат target-пользователя. Теперь rating
 *    и reviewsCount пересчитываются по оставшимся published-отзывам
 *    (recomputeUserRating, общая логика с одобрением отзыва). Фикстуры —
 *    явно published: pending/rejected в рейтинг не входят.
 *
 * 3) PATCH /admin/bookings/:id/status — до исправления переход
 *    active → declined/cancelled не возвращал место в seatsAvailable.
 *    Теперь активная бронь удерживает место, неактивная — освобождает
 *    (с защитой от выхода за seatsTotal и повторным удержанием).
 *
 * Паттерны репо (см. admin-feedback.test.ts): app.request(), логин через
 * POST /admin/auth/login с cookie edem_admin_jwt, уникальные vkUserId.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-123";

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

const createdUserIds: string[] = [];
const createdTripIds: string[] = [];
const createdBookingIds: string[] = [];
const createdReviewIds: string[] = [];
// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
let vkSeq = 9_200_000;

async function createUser(name: string): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `${name}-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=9",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function createTrip(
  driverId: string,
  overrides: { status?: string; seatsAvailable?: number } = {}
): Promise<string> {
  const trip = await db.trip.create({
    data: {
      driverId,
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      departureAt: new Date("2030-01-01T09:00:00Z"),
      durationMinutes: 120,
      distanceKm: 180,
      price: 700,
      seatsTotal: 3,
      seatsAvailable: overrides.seatsAvailable ?? 3,
      tags: [],
      ...(overrides.status ? { status: overrides.status } : {}),
    },
  });
  createdTripIds.push(trip.id);
  return trip.id;
}

async function createBooking(
  tripId: string,
  passengerId: string,
  seat: number,
  status: string
): Promise<string> {
  const booking = await db.booking.create({
    data: { tripId, passengerId, seat, status, comment: "" },
  });
  createdBookingIds.push(booking.id);
  return booking.id;
}

// Статус модерации — явно (дефолт схемы "pending" в рейтинг не входит):
// по умолчанию "published", чтобы recompute-тесты валидны против
// published-only агрегата.
async function createReview(
  authorId: string,
  targetUserId: string,
  rating: number,
  status: string = "published"
): Promise<string> {
  const review = await db.review.create({
    data: {
      authorId,
      targetUserId,
      targetRole: "driver",
      rating,
      text: `Отзыв с оценкой ${rating}`,
      tripRoute: "Москва → Тула",
      status,
    },
  });
  createdReviewIds.push(review.id);
  return review.id;
}

function adminRequest(
  method: string,
  path: string,
  cookie: string,
  body?: unknown
) {
  return app.request(path, {
    method,
    headers: { ...JSON_HEADERS, Cookie: `edem_admin_jwt=${cookie}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

afterEach(async () => {
  if (createdBookingIds.length > 0) {
    await db.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    createdBookingIds.length = 0;
  }
  if (createdReviewIds.length > 0) {
    await db.review.deleteMany({ where: { id: { in: createdReviewIds } } });
    createdReviewIds.length = 0;
  }
  if (createdTripIds.length > 0) {
    await db.trip.deleteMany({ where: { id: { in: createdTripIds } } });
    createdTripIds.length = 0;
  }
  if (createdUserIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("PATCH /admin/trips/:id/cancel — completion guard", () => {
  it("cancels an active trip (200, status → cancelled)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("CancelDriver");
    const tripId = await createTrip(driverId);

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/trips/${tripId}/cancel`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("cancelled");
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.status).toBe("cancelled");
  });

  it("rejects cancel of a completed trip (409 TRIP_NOT_ACTIVE)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("CompletedDriver");
    const tripId = await createTrip(driverId, { status: "completed" });

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/trips/${tripId}/cancel`,
      cookie
    );

    // Assert
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TRIP_NOT_ACTIVE");
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.status).toBe("completed");
  });

  it("rejects cancel of an already cancelled trip (409 TRIP_NOT_ACTIVE)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("CancelledDriver");
    const tripId = await createTrip(driverId, { status: "cancelled" });

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/trips/${tripId}/cancel`,
      cookie
    );

    // Assert
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("TRIP_NOT_ACTIVE");
  });

  it("returns 404 for a missing trip", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();

    // Act
    const res = await adminRequest(
      "PATCH",
      "/api/v1/admin/trips/nonexistent/cancel",
      cookie
    );

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /admin/bookings/:id/status — seat accounting", () => {
  it("active → declined restores seatsAvailable", async () => {
    // Arrange: активная (confirmed) бронь удерживает место: 3 → 2.
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("SeatDriver");
    const passengerId = await createUser("SeatPassenger");
    const tripId = await createTrip(driverId, { seatsAvailable: 2 });
    const bookingId = await createBooking(tripId, passengerId, 1, "confirmed");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/bookings/${bookingId}/status`,
      cookie,
      { status: "declined" }
    );

    // Assert
    expect(res.status).toBe(200);
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.seatsAvailable).toBe(3);
    const dbBooking = await db.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("declined");
  });

  it("inactive → active re-holds the seat (seatsAvailable decreases)", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("ReholdDriver");
    const passengerId = await createUser("ReholdPassenger");
    const tripId = await createTrip(driverId, { seatsAvailable: 3 });
    const bookingId = await createBooking(tripId, passengerId, 1, "declined");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/bookings/${bookingId}/status`,
      cookie,
      { status: "confirmed" }
    );

    // Assert
    expect(res.status).toBe(200);
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.seatsAvailable).toBe(2);
    const dbBooking = await db.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("confirmed");
  });

  it("active → active does not change seatsAvailable", async () => {
    // Arrange: pending → confirmed — место уже удержано активной бронью.
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("PendingDriver");
    const passengerId = await createUser("PendingPassenger");
    const tripId = await createTrip(driverId, { seatsAvailable: 2 });
    const bookingId = await createBooking(tripId, passengerId, 1, "pending");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/bookings/${bookingId}/status`,
      cookie,
      { status: "confirmed" }
    );

    // Assert
    expect(res.status).toBe(200);
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.seatsAvailable).toBe(2);
  });

  it("reactivation without free seats → 409 CONFLICT, seat not restored", async () => {
    // Arrange: мест нет (seatsAvailable 0), бронь неактивна.
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("FullDriver");
    const passengerId = await createUser("FullPassenger");
    const tripId = await createTrip(driverId, { seatsAvailable: 0 });
    const bookingId = await createBooking(tripId, passengerId, 1, "declined");

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/bookings/${bookingId}/status`,
      cookie,
      { status: "confirmed" }
    );

    // Assert
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CONFLICT");
    const dbBooking = await db.booking.findUnique({ where: { id: bookingId } });
    expect(dbBooking?.status).toBe("declined");
    const dbTrip = await db.trip.findUnique({ where: { id: tripId } });
    expect(dbTrip?.seatsAvailable).toBe(0);
  });
});

describe("DELETE /admin/reviews/:id — rating recompute", () => {
  it("recomputes rating and reviewsCount after deleting one of two reviews", async () => {
    // Arrange: два отзыва (5 и 3) → агрегат 4.0/2.
    // F14 partial unique index (authorId, targetUserId) WHERE tripId IS NULL:
    // каждому NULL-trip отзыву — свой автор, иначе второй INSERT → P2002.
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("RatingTarget");
    const authorId = await createUser("RatingAuthor");
    const authorId2 = await createUser("RatingAuthor2");
    await db.user.update({
      where: { id: targetUserId },
      data: { rating: 4.0, reviewsCount: 2 },
    });
    const reviewToDelete = await createReview(authorId, targetUserId, 5);
    await createReview(authorId2, targetUserId, 3);

    // Act
    const res = await adminRequest(
      "DELETE",
      `/api/v1/admin/reviews/${reviewToDelete}`,
      cookie
    );

    // Assert — отзыв удалён, агрегат пересчитан по оставшемуся отзыву.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(body.id).toBe(reviewToDelete);
    expect(await db.review.findUnique({ where: { id: reviewToDelete } })).toBeNull();

    const target = await db.user.findUnique({ where: { id: targetUserId } });
    expect(target?.rating).toBe(3.0);
    expect(target?.reviewsCount).toBe(1);
  });

  it("deleting the last review resets rating to 0 and reviewsCount to 0", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("LastReviewTarget");
    const authorId = await createUser("LastReviewAuthor");
    await db.user.update({
      where: { id: targetUserId },
      data: { rating: 5.0, reviewsCount: 1 },
    });
    const reviewId = await createReview(authorId, targetUserId, 5);

    // Act
    const res = await adminRequest(
      "DELETE",
      `/api/v1/admin/reviews/${reviewId}`,
      cookie
    );

    // Assert
    expect(res.status).toBe(200);
    const target = await db.user.findUnique({ where: { id: targetUserId } });
    expect(target?.rating).toBe(0);
    expect(target?.reviewsCount).toBe(0);
  });

  it("returns 404 for a missing review", async () => {
    // Arrange
    const cookie = await loginAndGetCookie();

    // Act
    const res = await adminRequest(
      "DELETE",
      "/api/v1/admin/reviews/00000000-0000-0000-0000-000000000000",
      cookie
    );

    // Assert
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});
