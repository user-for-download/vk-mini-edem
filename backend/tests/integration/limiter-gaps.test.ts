import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devMockAccessToken } from "../dev-mock-auth.js";

// ADMIN_TOKEN читается из env при импорте — задаём до импорта app
// (паттерн admin-auth.test.ts).
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-limiter-gaps";
});

const { app } = await import("../../src/app.js");
const { env } = await import("../../src/env.js");
const { db } = await import("../../src/db.js");

/**
 * Rate-limiter gaps на high-risk маршрутах (high-fixes-05):
 *
 * - PATCH /trips/:id/complete              — completeTripLimiter (user-based)
 * - PATCH /users/me, POST|PATCH /users/me/car — profileUpdateLimiter (user-based)
 * - PATCH /notifications/:id/read, /read-all — notificationReadLimiter (user-based)
 * - GET /reviews/my, /available-trips      — reviewsReadLimiter (user-based)
 * - GET /feedback                          — feedbackReadLimiter (user-based)
 * - все GET /admin                         — adminReadLimiter (IP-based, выше read-лимитера)
 *
 * Burst-тест шлёт ровно MAX+1 запрос: первые MAX проходят, (MAX+1)-й →
 * 429 RATE_LIMITED. Лимиты читаются из env — для новых переменных в
 * .env.test переопределений нет, действуют дефолты src/env.ts.
 *
 * Важно: в app.request (vitest) getConnInfo недоступен → все запросы
 * «приходят» с IP "unknown". IP-бакет общий в пределах файла (учтено в
 * admin-тесте); user-бакеты изолированы — на каждый тест создаётся
 * новый пользователь.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
const ADMIN_TOKEN = "test-admin-token-limiter-gaps";

// vkUserId — INT4: безопасный счётчик вместо Date.now() (выходит за 32 бита).
// Диапазон 5_400_000+ не пересекается с другими integration-suite.
let vkSeq = 5_400_000;

function mockAuth(userId: string) {
  // Формат high-fixes-01: mock-access-token-<userId>-<exp> + регистрация
  // пользователя в DEV_AUTH_USER_ALLOWLIST (иначе сервер отвечает 401).
  return { Authorization: `Bearer ${devMockAccessToken(userId)}` };
}

function extractAdminCookie(response: Response): string {
  const match = /edem_admin_jwt=([^;]+)/.exec(
    response.headers.get("set-cookie") ?? ""
  );
  if (!match) throw new Error("login did not set admin cookie");
  return match[1];
}

async function createUser(name: string): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `${name}-${++vkSeq}`,
      vkUserId: vkSeq,
      avatar: "https://i.pravatar.cc/200?img=9",
    },
  });
  return user.id;
}

/**
 * Шлёт до max+1 запросов, останавливаясь на первом 429.
 * Возвращает статусы прошедших (не 429) запросов и 429-ответ.
 */
async function burstUntilLimited(
  max: number,
  request: () => Promise<Response>
): Promise<{ statuses: number[]; limited: Response | null }> {
  const statuses: number[] = [];
  let limited: Response | null = null;

  for (let i = 1; i <= max + 1; i += 1) {
    const res = await request();
    if (res.status === 429) {
      limited = res;
      break;
    }
    statuses.push(res.status);
  }

  return { statuses, limited };
}

async function expectRateLimited(response: Response): Promise<void> {
  const body = (await response.json()) as { code?: string };
  expect(body.code).toBe("RATE_LIMITED");
}

describe("PATCH /trips/:id/complete — completeTripLimiter", () => {
  let driverId: string;
  let tripId: string;

  beforeEach(async () => {
    driverId = await createUser("CompleteDriver");
    const trip = await db.trip.create({
      data: {
        driverId,
        fromCity: "Москва",
        fromAddress: "Тверская 1",
        toCity: "Тула",
        toAddress: "пр-т Ленина 1",
        departureAt: new Date("2030-01-01T09:00:00Z"),
        durationMinutes: 120,
        distanceKm: 180,
        price: 700,
        seatsTotal: 3,
        seatsAvailable: 3,
        tags: [],
        status: "active",
      },
    });
    tripId = trip.id;
  });

  afterEach(async () => {
    await db.trip.deleteMany({ where: { driverId } });
    await db.user.deleteMany({ where: { id: driverId } });
  });

  it("первое завершение 200, повторы 400, (MAX+1)-й запрос — 429 RATE_LIMITED", async () => {
    const max = env.COMPLETE_TRIP_RATE_MAX;

    // Обычный флоу: завершение работает (force=1 — только dev/test).
    const first = await app.request(
      `/api/v1/trips/${tripId}/complete?force=1`,
      { method: "PATCH", headers: mockAuth(driverId) }
    );
    expect(first.status).toBe(200);

    // Поездка уже completed: следующие попытки — бизнес-ошибка (400),
    // а не 429 — пока не исчерпан user-лимит.
    const { statuses, limited } = await burstUntilLimited(
      max - 1,
      async () =>
        app.request(`/api/v1/trips/${tripId}/complete`, {
          method: "PATCH",
          headers: mockAuth(driverId),
        })
    );

    expect(statuses).toHaveLength(max - 1);
    expect(new Set(statuses).size).toBe(1);
    expect(statuses[0]).toBe(400);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});

describe("users: PATCH /me и /me/car — profileUpdateLimiter", () => {
  let userId: string;
  let carCreated = false;

  beforeEach(async () => {
    userId = await createUser("ProfileUser");
  });

  afterEach(async () => {
    if (carCreated) {
      await db.car.deleteMany({ where: { userId } });
    }
    await db.user.deleteMany({ where: { id: userId } });
    carCreated = false;
  });

  it("PATCH /users/me: MAX обновлений 200, (MAX+1)-е — 429 RATE_LIMITED", async () => {
    const max = env.PROFILE_UPDATE_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () =>
        app.request("/api/v1/users/me", {
          method: "PATCH",
          headers: { ...JSON_HEADERS, ...mockAuth(userId) },
          body: JSON.stringify({ name: "RateLimitUser" }),
        })
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });

  it("POST /users/me/car: MAX сохранений 200, (MAX+1)-е — 429 RATE_LIMITED", async () => {
    const max = env.PROFILE_UPDATE_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () => {
        carCreated = true;
        return app.request("/api/v1/users/me/car", {
          method: "POST",
          headers: { ...JSON_HEADERS, ...mockAuth(userId) },
          body: JSON.stringify({
            model: "Lada",
            color: "white",
            plate: `RG${vkSeq}`,
          }),
        });
      }
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});

describe("notifications: read / read-all — notificationReadLimiter", () => {
  let userId: string;
  let notificationId: string;

  beforeEach(async () => {
    userId = await createUser("NotificationUser");
    const notification = await db.notification.create({
      data: { userId, type: "test_read", title: "Тест", body: "Тестовое уведомление" },
    });
    notificationId = notification.id;
  });

  afterEach(async () => {
    await db.notification.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("PATCH /:id/read: легитимный запрос 200 и isRead=true", async () => {
    const res = await app.request(`/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: mockAuth(userId),
    });
    expect(res.status).toBe(200);

    const stored = await db.notification.findUnique({ where: { id: notificationId } });
    expect(stored?.isRead).toBe(true);
  });

  it("PATCH /read-all: MAX запросов 200, (MAX+1)-й — 429 RATE_LIMITED", async () => {
    const max = env.NOTIFICATION_READ_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () =>
        app.request("/api/v1/notifications/read-all", {
          method: "PATCH",
          headers: mockAuth(userId),
        })
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});

describe("reviews: my / available-trips — reviewsReadLimiter", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createUser("ReviewsReader");
  });

  afterEach(async () => {
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("GET /reviews/my: MAX запросов 200, (MAX+1)-й — 429 RATE_LIMITED", async () => {
    const max = env.REVIEWS_READ_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () => app.request("/api/v1/reviews/my", { headers: mockAuth(userId) })
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });

  it("GET /reviews/available-trips: MAX запросов 200, (MAX+1)-й — 429", async () => {
    const max = env.REVIEWS_READ_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () =>
        app.request("/api/v1/reviews/available-trips", { headers: mockAuth(userId) })
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});

describe("GET /feedback — feedbackReadLimiter", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await createUser("FeedbackReader");
    await db.feedback.create({
      data: { userId, subject: "Тема", text: "Тестовое обращение" },
    });
  });

  afterEach(async () => {
    await db.feedback.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  it("MAX запросов 200 (список своих обращений), (MAX+1)-й — 429", async () => {
    const max = env.FEEDBACK_READ_RATE_MAX;

    const { statuses, limited } = await burstUntilLimited(
      max,
      async () => app.request("/api/v1/feedback", { headers: mockAuth(userId) })
    );

    expect(statuses).toHaveLength(max);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});

describe("admin GET — adminReadLimiter (IP-based)", () => {
  it("легитимные GET 200; исчерпание IP-бюджета — 429 RATE_LIMITED", async () => {
    const max = env.ADMIN_READ_RATE_MAX;

    // Логин — POST: adminReadLimiter его не считает (привязан к GET-роутам).
    const login = await app.request("/api/v1/admin/auth/login", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token: ADMIN_TOKEN }),
    });
    expect(login.status).toBe(200);
    const cookie = `edem_admin_jwt=${extractAdminCookie(login)}`;

    // Легитимные GET (нормальный флоу админки): 200. В vitest все
    // запросы — с одного IP "unknown", поэтому они тратят общий бюджет.
    const dashboard = await app.request("/api/v1/admin/dashboard", {
      headers: { Cookie: cookie },
    });
    expect(dashboard.status).toBe(200);

    const session = await app.request("/api/v1/admin/auth/session", {
      headers: { Cookie: cookie },
    });
    expect(session.status).toBe(200);
    expect((await session.json()).authenticated).toBe(true);

    // Предыдущие 2 запроса уже в бюджете → 429 на (max-2)-м burst-запросе.
    const { statuses, limited } = await burstUntilLimited(
      max,
      async () =>
        app.request("/api/v1/admin/auth/session", { headers: { Cookie: cookie } })
    );

    expect(statuses).toHaveLength(max - 2);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect(limited).not.toBeNull();
    await expectRateLimited(limited!);
  });
});
