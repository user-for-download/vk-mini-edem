import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

/**
 * GET /api/v1/feedback — список СВОИХ обращений в поддержку.
 *
 * Поведение: требует авторизации (requireUser), возвращает только обращения
 * текущего пользователя, новые первыми. reply/repliedAt приходят как null,
 * если админ ещё не ответил; иначе — текст и ISO-дату ответа.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };
let vkSeq = 8_400_000;

describe("GET /api/v1/feedback (user-side list)", () => {
  let userId: string;
  let otherUserId: string;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        name: `FeedbackList-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=5",
      },
    });
    userId = user.id;

    const other = await db.user.create({
      data: {
        name: `FeedbackOther-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=6",
      },
    });
    otherUserId = other.id;
  });

  afterEach(async () => {
    await db.feedback.deleteMany({ where: { userId } });
    await db.feedback.deleteMany({ where: { userId: otherUserId } });
    await db.user.deleteMany({
      where: { id: { in: [userId, otherUserId] } },
    });
  });

  const getMine = (token: string) =>
    app.request("/api/v1/feedback", {
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    });

  it("401 без авторизации", async () => {
    const res = await app.request("/api/v1/feedback", {
      headers: JSON_HEADERS,
    });
    expect(res.status).toBe(401);
  });

  it("200: пустой массив, если у пользователя нет обращений", async () => {
    const res = await getMine(devMockAccessToken(userId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("200: возвращает только СВОИ обращения, новые первыми", async () => {
    const old = await db.feedback.create({
      data: { userId, subject: "Старое", text: "A" },
    });
    const fresh = await db.feedback.create({
      data: { userId, subject: "Свежее", text: "B" },
    });
    // Чужое обращение — не должно попасть.
    await db.feedback.create({
      data: { userId: otherUserId, subject: "Чужое", text: "C" },
    });

    const res = await getMine(devMockAccessToken(userId));
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{
      id: string;
      subject: string;
      reply: string | null;
      repliedAt: string | null;
    }>;
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe(fresh.id);
    expect(body[0].subject).toBe("Свежее");
    expect(body[0].reply).toBeNull();
    expect(body[0].repliedAt).toBeNull();
    expect(body[1].id).toBe(old.id);
    expect(body[1].subject).toBe("Старое");
  });

  it("reply/repliedAt приходят заполненными, когда админ уже ответил", async () => {
    const repliedAt = new Date();
    await db.feedback.create({
      data: {
        userId,
        subject: "Вопрос",
        text: "Текст",
        reply: "Ответ поддержки",
        repliedAt,
      },
    });

    const res = await getMine(devMockAccessToken(userId));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{
      reply: string | null;
      repliedAt: string | null;
    }>;
    expect(body[0].reply).toBe("Ответ поддержки");
    expect(body[0].repliedAt).toBe(repliedAt.toISOString());
  });
});
