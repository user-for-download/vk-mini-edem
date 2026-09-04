import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ADMIN_TOKEN читается из env при импорте — задаём до импорта app.
vi.hoisted(() => {
  process.env.ADMIN_TOKEN = "test-admin-token-123";
  process.env.ADMIN_LOGIN_RATE_WINDOW_MS = "300000";
  process.env.ADMIN_LOGIN_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");

/**
 * GET /api/v1/admin/feedback — список обращений пользователей в поддержку.
 * Read-only, offset-пагинация, новые первыми, доступ только с admin-cookie.
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

describe("GET /api/v1/admin/feedback", () => {
  let userId: string;
  let adminCookie: string;
  const createdFeedbackIds: string[] = [];
  // Диапазон vkUserId не пересекается с другими интеграционными тестами.
  let vkSeq = 8_200_000;

  beforeEach(async () => {
    adminCookie = await loginAndGetCookie();

    const user = await db.user.create({
      data: {
        name: `FeedbackAdmin-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=4",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    if (createdFeedbackIds.length > 0) {
      await db.feedback.deleteMany({ where: { id: { in: createdFeedbackIds } } });
      createdFeedbackIds.length = 0;
    }
    await db.feedback.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  async function seedFeedbacks(count: number) {
    for (let i = 0; i < count; i++) {
      const feedback = await db.feedback.create({
        data: {
          userId,
          subject: `Тема ${i}`,
          text: `Текст ${i}`,
          createdAt: new Date(Date.now() - i * 1000),
        },
      });
      createdFeedbackIds.push(feedback.id);
    }
  }

  const getFeedback = (query = "", cookie?: string) =>
    app.request(`/api/v1/admin/feedback${query}`, {
      headers: cookie ? { Cookie: `edem_admin_jwt=${cookie}` } : {},
    });

  it("без cookie -> 401", async () => {
    const res = await getFeedback();
    expect(res.status).toBe(401);
  });

  it("пустой список -> 200 и total 0", async () => {
    const res = await getFeedback("", adminCookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  it("возвращает обращения новыми первыми с данными автора", async () => {
    await seedFeedbacks(3);

    const res = await getFeedback("", adminCookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      items: Array<{
        id: string;
        subject: string;
        text: string;
        createdAt: string;
        userId: string;
        userName: string;
      }>;
      total: number;
    };
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(3);
    expect(body.items[0].subject).toBe("Тема 0");
    expect(body.items[0].userId).toBe(userId);
    expect(body.items[0].userName).toBeTruthy();
    expect(new Date(body.items[0].createdAt).getTime()).not.toBeNaN();
  });

  it("пагинация: pageSize ограничивает выборку", async () => {
    await seedFeedbacks(5);

    const res = await getFeedback("?page=1&pageSize=2", adminCookie);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
  });

  it("вторая страница без пересечения с первой", async () => {
    await seedFeedbacks(5);

    const first = await getFeedback("?page=1&pageSize=2", adminCookie);
    const second = await getFeedback("?page=2&pageSize=2", adminCookie);

    const firstBody = (await first.json()) as { items: Array<{ id: string }> };
    const secondBody = (await second.json()) as { items: Array<{ id: string }> };

    const firstIds = firstBody.items.map((item) => item.id);
    const secondIds = secondBody.items.map((item) => item.id);

    expect(secondIds).toHaveLength(2);
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it("невалидный page -> 400", async () => {
    const res = await getFeedback("?page=0", adminCookie);
    expect(res.status).toBe(400);
  });
});
