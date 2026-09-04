import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN и лимиты логина читаются из env при старте/импорте.
// Задаём до импорта app; лимит завышаем, чтобы тест не упёрся в 429.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-789";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");

/**
 * Интеграционное покрытие модерационного workflow (state machine статуса
 * отзыва):
 *
 *   pending --approve--> published   (публичный, входит в рейтинг)
 *   pending --reject---> rejected    (скрыт, в рейтинг не входит)
 *   любой статус --DELETE--> удалён  (recompute по оставшимся published)
 *
 * Поведение:
 * - POST /reviews создаёт отзыв со статусом "pending": в публичном списке
 *   его нет, рейтинг target-пользователя НЕ меняется; автор видит отзыв
 *   в GET /reviews/my со статусом.
 * - PATCH /admin/reviews/:id/approve — pending → published, рейтинг
 *   пересчитывается (отзыв теперь учитывается), автору — уведомление
 *   review_approved.
 * - PATCH /admin/reviews/:id/reject — pending → rejected, рейтинг НЕ
 *   меняется (pending в него никогда не входил), автору — уведомление
 *   review_rejected.
 * - approve/reject для non-pending → 409 CONFLICT; неизвестный id → 404.
 * - GET /reviews/user/:userId — только published.
 * - GET /reviews/my — статус у каждого отзыва автора.
 * - GET /admin/reviews?status= — фильтр по статусу; без параметра — все.
 * - DELETE /admin/reviews/:id — работает из любого статуса; пересчёт
 *   рейтинга по оставшимся published.
 *
 * Паттерны репо (admin-moderation.test.ts, reviews-pagination.test.ts):
 * app.request(), логин админа через POST /admin/auth/login с cookie
 * edem_admin_jwt, dev-авторизация пользователя Bearer mock-access-token-{userId},
 * уникальные vkUserId, очистка в afterEach.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-789";
const DAY_MS = 24 * 60 * 60 * 1000;
const MISSING_UUID = "00000000-0000-0000-0000-000000000000";

type ReviewStatus = "pending" | "published" | "rejected";

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
// Диапазон 9_600_000+ не пересекается с другими integration-suite.
let vkSeq = 9_600_000;

async function createUser(name: string): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `${name}-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=9",
      // Явно включаем: уведомления об approve/reject — некритичный тип,
      // при notificationsEnabled=false createNotification их не создаст.
      notificationsEnabled: true,
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

// Прошедшая completed-поездка: проходит проверки POST /reviews
// («поездка уже началась/завершена», «не отменена»).
async function createPastTrip(driverId: string): Promise<string> {
  const trip = await db.trip.create({
    data: {
      driverId,
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Тула",
      toAddress: "пр-т Ленина",
      departureAt: new Date(Date.now() - DAY_MS),
      durationMinutes: 120,
      distanceKm: 180,
      price: 700,
      seatsTotal: 3,
      seatsAvailable: 3,
      tags: [],
      status: "completed",
    },
  });
  createdTripIds.push(trip.id);
  return trip.id;
}

// Подтверждённая бронь — пассажир становится участником (обязательно
// для POST /reviews).
async function createBooking(tripId: string, passengerId: string): Promise<string> {
  const booking = await db.booking.create({
    data: { tripId, passengerId, seat: 1, status: "confirmed", comment: "" },
  });
  createdBookingIds.push(booking.id);
  return booking.id;
}

// Seed напрямую в БД: нужен для отзывов в заданном статусе (API создаёт
// только pending) и для базового рейтингового агрегата.
async function createReviewDirect(
  authorId: string,
  targetUserId: string,
  rating: number,
  status: ReviewStatus,
  createdAt?: Date
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
      ...(createdAt ? { createdAt } : {}),
    },
  });
  createdReviewIds.push(review.id);
  return review.id;
}

// POST /api/v1/reviews от лица автора (dev-авторизация mock-токеном).
async function createReviewViaApi(
  authorId: string,
  params: { tripId: string; targetUserId: string; rating: number; text?: string }
): Promise<Response> {
  return app.request("/api/v1/reviews", {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer mock-access-token-${authorId}`,
    },
    body: JSON.stringify({
      tripId: params.tripId,
      targetUserId: params.targetUserId,
      rating: params.rating,
      text: params.text ?? "Хорошая поездка, всё было отлично.",
    }),
  });
}

function publicReviews(targetUserId: string): Promise<Response> {
  return app.request(`/api/v1/reviews/user/${targetUserId}`);
}

// GET /api/v1/reviews/my от лица автора.
function myReviews(authorId: string): Promise<Response> {
  return app.request("/api/v1/reviews/my", {
    headers: { Authorization: `Bearer mock-access-token-${authorId}` },
  });
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

async function getTargetAggregate(
  targetUserId: string
): Promise<{ rating: number; reviewsCount: number }> {
  const user = await db.user.findUnique({ where: { id: targetUserId } });
  return { rating: user?.rating ?? 0, reviewsCount: user?.reviewsCount ?? 0 };
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
    // Удаление пользователя каскадно чистит и его Notification
    // (onDelete: Cascade) — review_approved/review_rejected не остаются.
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("POST /reviews — moderation gate (create)", () => {
  it("creates the review as pending: hidden from the public list, rating unchanged, visible in /my", async () => {
    // Arrange: у водителя один published-отзыв (5) → рейтинг 5.0/1.
    const driverId = await createUser("GateDriver");
    const passengerId = await createUser("GatePassenger");
    const thirdUserId = await createUser("GateThird");
    const tripId = await createPastTrip(driverId);
    await createBooking(tripId, passengerId);
    await createReviewDirect(thirdUserId, driverId, 5, "published");
    await db.user.update({
      where: { id: driverId },
      data: { rating: 5.0, reviewsCount: 1 },
    });
    const aggregateBefore = await getTargetAggregate(driverId);

    // Act
    const res = await createReviewViaApi(passengerId, {
      tripId,
      targetUserId: driverId,
      rating: 3,
    });

    // Assert — 201, статус pending.
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      id: string;
      status: string;
      rating: number;
      targetRole: string;
    };
    expect(created.status).toBe("pending");
    expect(created.rating).toBe(3);
    expect(created.targetRole).toBe("driver");
    createdReviewIds.push(created.id);

    const stored = await db.review.findUnique({ where: { id: created.id } });
    expect(stored?.status).toBe("pending");

    // Рейтинг target-пользователя pending-отзывом не меняется.
    expect(await getTargetAggregate(driverId)).toEqual(aggregateBefore);

    // Публичный список: виден только published-отзыв.
    const publicRes = await publicReviews(driverId);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as {
      items: Array<{ id: string; status: string }>;
    };
    expect(publicBody.items).toHaveLength(1);
    expect(publicBody.items[0].id).not.toBe(created.id);
    expect(publicBody.items[0].status).toBe("published");

    // /my (от лица автора): отзыв виден со статусом pending.
    const myRes = await myReviews(passengerId);
    expect(myRes.status).toBe(200);
    const myBody = (await myRes.json()) as Array<{
      id: string;
      status: string;
      rating: number;
    }>;
    expect(myBody).toHaveLength(1);
    expect(myBody[0].id).toBe(created.id);
    expect(myBody[0].status).toBe("pending");
    expect(myBody[0].rating).toBe(3);
  });
});

describe("PATCH /admin/reviews/:id/approve", () => {
  it("pending → published: visible in the public list, rating recomputed, author notified", async () => {
    // Arrange: база — один published-отзыв (5) → рейтинг 5.0/1.
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("ApproveDriver");
    const passengerId = await createUser("ApprovePassenger");
    const thirdUserId = await createUser("ApproveThird");
    const tripId = await createPastTrip(driverId);
    await createBooking(tripId, passengerId);
    await createReviewDirect(thirdUserId, driverId, 5, "published");
    await db.user.update({
      where: { id: driverId },
      data: { rating: 5.0, reviewsCount: 1 },
    });

    const createRes = await createReviewViaApi(passengerId, {
      tripId,
      targetUserId: driverId,
      rating: 3,
    });
    expect(createRes.status).toBe(201);
    const reviewId = ((await createRes.json()) as { id: string }).id;
    createdReviewIds.push(reviewId);

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${reviewId}/approve`,
      cookie
    );

    // Assert — 200, статус published.
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      status: string;
      targetUserId: string;
    };
    expect(body.id).toBe(reviewId);
    expect(body.status).toBe("published");
    expect(body.targetUserId).toBe(driverId);

    const stored = await db.review.findUnique({ where: { id: reviewId } });
    expect(stored?.status).toBe("published");

    // Публичный список: теперь оба отзыва.
    const publicRes = await publicReviews(driverId);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as {
      items: Array<{ id: string }>;
    };
    expect(publicBody.items).toHaveLength(2);
    expect(publicBody.items.some((r) => r.id === reviewId)).toBe(true);

    // Рейтинг пересчитан по published: (5 + 3) / 2 = 4.0, count 2.
    const target = await db.user.findUnique({ where: { id: driverId } });
    expect(target?.rating).toBe(4.0);
    expect(target?.reviewsCount).toBe(2);

    // Уведомление автору (опция A).
    const notifs = await db.notification.findMany({
      where: { userId: passengerId, type: "review_approved" },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Отзыв опубликован");
    expect(notifs[0].isRead).toBe(false);
  });

  it("approving a published review → 409 CONFLICT, status unchanged", async () => {
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("ApprovePubTarget");
    const authorId = await createUser("ApprovePubAuthor");
    const reviewId = await createReviewDirect(authorId, targetUserId, 4, "published");

    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${reviewId}/approve`,
      cookie
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CONFLICT");
    expect(
      (await db.review.findUnique({ where: { id: reviewId } }))?.status
    ).toBe("published");
  });

  it("approving a rejected review → 409 CONFLICT, status unchanged", async () => {
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("ApproveRejTarget");
    const authorId = await createUser("ApproveRejAuthor");
    const reviewId = await createReviewDirect(authorId, targetUserId, 4, "rejected");

    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${reviewId}/approve`,
      cookie
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CONFLICT");
    expect(
      (await db.review.findUnique({ where: { id: reviewId } }))?.status
    ).toBe("rejected");
  });

  it("returns 404 for a missing review", async () => {
    const cookie = await loginAndGetCookie();

    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${MISSING_UUID}/approve`,
      cookie
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /admin/reviews/:id/reject", () => {
  it("pending → rejected: hidden from the public list, rating unchanged, author notified", async () => {
    // Arrange: база — один published-отзыв (5) → рейтинг 5.0/1.
    const cookie = await loginAndGetCookie();
    const driverId = await createUser("RejectDriver");
    const passengerId = await createUser("RejectPassenger");
    const thirdUserId = await createUser("RejectThird");
    const tripId = await createPastTrip(driverId);
    await createBooking(tripId, passengerId);
    await createReviewDirect(thirdUserId, driverId, 5, "published");
    await db.user.update({
      where: { id: driverId },
      data: { rating: 5.0, reviewsCount: 1 },
    });
    const aggregateBefore = await getTargetAggregate(driverId);

    const createRes = await createReviewViaApi(passengerId, {
      tripId,
      targetUserId: driverId,
      rating: 2,
    });
    expect(createRes.status).toBe(201);
    const reviewId = ((await createRes.json()) as { id: string }).id;
    createdReviewIds.push(reviewId);

    // Act
    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${reviewId}/reject`,
      cookie
    );

    // Assert — 200, статус rejected.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.id).toBe(reviewId);
    expect(body.status).toBe("rejected");

    const stored = await db.review.findUnique({ where: { id: reviewId } });
    expect(stored?.status).toBe("rejected");

    // Публичный список: отклонённый отзыв скрыт (видна только база).
    const publicRes = await publicReviews(driverId);
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as {
      items: Array<{ id: string }>;
    };
    expect(publicBody.items).toHaveLength(1);
    expect(publicBody.items[0].id).not.toBe(reviewId);

    // Рейтинг не меняется: pending в него никогда не входил.
    expect(await getTargetAggregate(driverId)).toEqual(aggregateBefore);

    // /my (от лица автора): статус rejected.
    const myRes = await myReviews(passengerId);
    expect(myRes.status).toBe(200);
    const myBody = (await myRes.json()) as Array<{
      id: string;
      status: string;
    }>;
    expect(myBody).toHaveLength(1);
    expect(myBody[0].id).toBe(reviewId);
    expect(myBody[0].status).toBe("rejected");

    // Уведомление автору (опция A).
    const notifs = await db.notification.findMany({
      where: { userId: passengerId, type: "review_rejected" },
    });
    expect(notifs).toHaveLength(1);
    expect(notifs[0].title).toBe("Отзыв отклонён");
    expect(notifs[0].isRead).toBe(false);
  });

  it("rejecting a published review → 409 CONFLICT, status unchanged", async () => {
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("RejectPubTarget");
    const authorId = await createUser("RejectPubAuthor");
    const reviewId = await createReviewDirect(authorId, targetUserId, 4, "published");

    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${reviewId}/reject`,
      cookie
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("CONFLICT");
    expect(
      (await db.review.findUnique({ where: { id: reviewId } }))?.status
    ).toBe("published");
  });

  it("returns 404 for a missing review", async () => {
    const cookie = await loginAndGetCookie();

    const res = await adminRequest(
      "PATCH",
      `/api/v1/admin/reviews/${MISSING_UUID}/reject`,
      cookie
    );

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("GET /reviews/user/:userId — published only", () => {
  it("shows published and hides pending/rejected", async () => {
    // Arrange: три отзыва с разными статусами (createdAt различаются —
    // порядок desc не влияет на выборку, фильтрация по статусу).
    const targetUserId = await createUser("PubOnlyTarget");
    const authorId = await createUser("PubOnlyAuthor");
    const base = Date.now() - 3 * DAY_MS;
    const publishedId = await createReviewDirect(
      authorId,
      targetUserId,
      5,
      "published",
      new Date(base)
    );
    await createReviewDirect(
      authorId,
      targetUserId,
      4,
      "pending",
      new Date(base + DAY_MS)
    );
    await createReviewDirect(
      authorId,
      targetUserId,
      3,
      "rejected",
      new Date(base + 2 * DAY_MS)
    );

    // Act
    const res = await publicReviews(targetUserId);

    // Assert — в публичном списке только published.
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; status: string }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(publishedId);
    expect(body.items[0].status).toBe("published");
  });
});

describe("GET /reviews/my — includes status", () => {
  it("returns the author's reviews with status for every status value", async () => {
    // Arrange
    const authorId = await createUser("MyStatusAuthor");
    const targetUserId = await createUser("MyStatusTarget");
    const base = Date.now() - 3 * DAY_MS;
    const pendingId = await createReviewDirect(
      authorId,
      targetUserId,
      4,
      "pending",
      new Date(base)
    );
    const publishedId = await createReviewDirect(
      authorId,
      targetUserId,
      5,
      "published",
      new Date(base + DAY_MS)
    );
    const rejectedId = await createReviewDirect(
      authorId,
      targetUserId,
      2,
      "rejected",
      new Date(base + 2 * DAY_MS)
    );

    // Act
    const res = await myReviews(authorId);

    // Assert — все три отзыва автора, у каждого правильный статус.
    expect(res.status).toBe(200);
    const items = (await res.json()) as Array<{ id: string; status: string }>;
    expect(items).toHaveLength(3);
    const statusOf = (id: string) => items.find((r) => r.id === id)?.status;
    expect(statusOf(pendingId)).toBe("pending");
    expect(statusOf(publishedId)).toBe("published");
    expect(statusOf(rejectedId)).toBe("rejected");
  });
});

describe("GET /admin/reviews?status= — filter", () => {
  // 5 отзывов: 2 pending, 2 published, 1 rejected.
  const statuses: ReviewStatus[] = [
    "pending",
    "pending",
    "published",
    "published",
    "rejected",
  ];
  const idsByStatus: Record<ReviewStatus, string[]> = {
    pending: [],
    published: [],
    rejected: [],
  };
  let cookie: string;

  // idsByStatus живёт на уровне describe: чистим между тестами,
  // иначе массивы аккумулируют id из предыдущих итений.
  beforeEach(() => {
    idsByStatus.pending.length = 0;
    idsByStatus.published.length = 0;
    idsByStatus.rejected.length = 0;
  });

  async function seedFilterFixtures() {
    const targetUserId = await createUser("FilterTarget");
    const authorId = await createUser("FilterAuthor");
    const base = Date.now() - 5 * DAY_MS;
    for (let i = 0; i < statuses.length; i++) {
      const id = await createReviewDirect(
        authorId,
        targetUserId,
        (i % 5) + 1,
        statuses[i],
        new Date(base + i * DAY_MS)
      );
      idsByStatus[statuses[i]].push(id);
    }
  }

  async function fetchAdminReviews(query = ""): Promise<{
    total: number;
    items: Array<{ id: string; status: string }>;
  }> {
    const res = await adminRequest(
      "GET",
      `/api/v1/admin/reviews${query ? `?${query}` : ""}`,
      cookie
    );
    expect(res.status).toBe(200);
    return res.json();
  }

  it("returns only pending with ?status=pending", async () => {
    cookie = await loginAndGetCookie();
    await seedFilterFixtures();

    const body = await fetchAdminReviews("status=pending");

    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((r) => r.status === "pending")).toBe(true);
    expect(body.items.map((r) => r.id).sort()).toEqual(
      [...idsByStatus.pending].sort()
    );
  });

  it("returns only published with ?status=published", async () => {
    cookie = await loginAndGetCookie();
    await seedFilterFixtures();

    const body = await fetchAdminReviews("status=published");

    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((r) => r.status === "published")).toBe(true);
    expect(body.items.map((r) => r.id).sort()).toEqual(
      [...idsByStatus.published].sort()
    );
  });

  it("returns only rejected with ?status=rejected", async () => {
    cookie = await loginAndGetCookie();
    await seedFilterFixtures();

    const body = await fetchAdminReviews("status=rejected");

    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].status).toBe("rejected");
    expect(body.items[0].id).toBe(idsByStatus.rejected[0]);
  });

  it("returns all reviews without the status param", async () => {
    cookie = await loginAndGetCookie();
    await seedFilterFixtures();

    const body = await fetchAdminReviews();

    expect(body.total).toBe(5);
    expect(body.items).toHaveLength(5);
    const statusesSeen = body.items.map((r) => r.status).sort();
    expect(statusesSeen).toEqual(
      ["pending", "pending", "published", "published", "rejected"].sort()
    );
  });
});

describe("DELETE /admin/reviews/:id — recompute from any status", () => {
  it("deleting a published review recomputes the rating (published only)", async () => {
    // Arrange: два published (5 и 3) → агрегат 4.0/2.
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("DelPubTarget");
    const authorId = await createUser("DelPubAuthor");
    const reviewToDelete = await createReviewDirect(
      authorId,
      targetUserId,
      5,
      "published"
    );
    await createReviewDirect(authorId, targetUserId, 3, "published");
    await db.user.update({
      where: { id: targetUserId },
      data: { rating: 4.0, reviewsCount: 2 },
    });

    // Act
    const res = await adminRequest(
      "DELETE",
      `/api/v1/admin/reviews/${reviewToDelete}`,
      cookie
    );

    // Assert — отзыв удалён, агрегат пересчитан по оставшемуся published.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; id: string };
    expect(body.ok).toBe(true);
    expect(body.id).toBe(reviewToDelete);
    expect(await db.review.findUnique({ where: { id: reviewToDelete } })).toBeNull();

    const target = await db.user.findUnique({ where: { id: targetUserId } });
    expect(target?.rating).toBe(3.0);
    expect(target?.reviewsCount).toBe(1);
  });

  it("deleting a pending review does not change the rating", async () => {
    // Arrange: один published (5) → 5.0/1; pending (2) в рейтинг не входит.
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("DelPendTarget");
    const authorId = await createUser("DelPendAuthor");
    await createReviewDirect(authorId, targetUserId, 5, "published");
    const reviewToDelete = await createReviewDirect(
      authorId,
      targetUserId,
      2,
      "pending"
    );
    await db.user.update({
      where: { id: targetUserId },
      data: { rating: 5.0, reviewsCount: 1 },
    });
    const aggregateBefore = await getTargetAggregate(targetUserId);

    // Act
    const res = await adminRequest(
      "DELETE",
      `/api/v1/admin/reviews/${reviewToDelete}`,
      cookie
    );

    // Assert — pending удалён, агрегат published не изменился.
    expect(res.status).toBe(200);
    expect(
      await db.review.findUnique({ where: { id: reviewToDelete } })
    ).toBeNull();
    expect(await getTargetAggregate(targetUserId)).toEqual(aggregateBefore);
  });

  it("deleting a rejected review does not change the rating", async () => {
    // Arrange: один published (5) → 5.0/1; rejected (2) в рейтинг не входит.
    const cookie = await loginAndGetCookie();
    const targetUserId = await createUser("DelRejTarget");
    const authorId = await createUser("DelRejAuthor");
    await createReviewDirect(authorId, targetUserId, 5, "published");
    const reviewToDelete = await createReviewDirect(
      authorId,
      targetUserId,
      2,
      "rejected"
    );
    await db.user.update({
      where: { id: targetUserId },
      data: { rating: 5.0, reviewsCount: 1 },
    });
    const aggregateBefore = await getTargetAggregate(targetUserId);

    // Act
    const res = await adminRequest(
      "DELETE",
      `/api/v1/admin/reviews/${reviewToDelete}`,
      cookie
    );

    // Assert — rejected удалён, агрегат published не изменился.
    expect(res.status).toBe(200);
    expect(
      await db.review.findUnique({ where: { id: reviewToDelete } })
    ).toBeNull();
    expect(await getTargetAggregate(targetUserId)).toEqual(aggregateBefore);
  });
});
