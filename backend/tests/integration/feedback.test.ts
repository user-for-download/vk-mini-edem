import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { db } from "../../src/db.js";
import { devMockAccessToken } from "../dev-mock-auth.js";

/**
 * POST /api/v1/feedback — обращения пользователей в поддержку.
 *
 * Паттерны репо: app.request(), dev-авторизация mock-токеном
 * (tests/dev-mock-auth.js: allowlist + TTL), уникальные vkUserId, очистка в afterEach.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

describe("POST /api/v1/feedback", () => {
  let userId: string;
  // vkUserId — INT4: безопасный счётчик вместо Date.now().
  // Диапазон не должен пересекаться с другими интеграционными тестами
  // (1_500_000…5_300_000, 7_700_000) — они идут параллельно в одну БД.
  let vkSeq = 8_100_000;

  beforeEach(async () => {
    const user = await db.user.create({
      data: {
        name: `Feedback-${Date.now()}`,
        vkUserId: ++vkSeq,
        avatar: "https://i.pravatar.cc/200?img=3",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await db.feedback.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  const postFeedback = (body: unknown, token?: string) =>
    app.request("/api/v1/feedback", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it("401 без авторизации", async () => {
    const res = await postFeedback({ subject: "Тема", text: "Текст" });
    expect(res.status).toBe(401);
  });

  it("201: сохраняет обращение и возвращает id + createdAt", async () => {
    const res = await postFeedback(
      { subject: "Не приходит уведомление", text: "После брони нет push." },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string; createdAt: string };
    expect(body.id).toBeTruthy();
    expect(new Date(body.createdAt).getTime()).not.toBeNaN();

    const stored = await db.feedback.findUnique({ where: { id: body.id } });
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(userId);
    expect(stored?.subject).toBe("Не приходит уведомление");
    expect(stored?.text).toBe("После брони нет push.");
  });

  it("400: пустая тема", async () => {
    const res = await postFeedback(
      { subject: "", text: "Текст" },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(400);

    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("400: пустой текст", async () => {
    const res = await postFeedback(
      { subject: "Тема", text: "" },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(400);
  });

  it("400: тема длиннее 100 символов", async () => {
    const res = await postFeedback(
      { subject: "x".repeat(101), text: "Текст" },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(400);
  });

  it("400: текст длиннее 2000 символов", async () => {
    const res = await postFeedback(
      { subject: "Тема", text: "x".repeat(2001) },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(400);
  });

  it("принимает тему ровно в 100 символов", async () => {
    const res = await postFeedback(
      { subject: "x".repeat(100), text: "Текст" },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(201);
  });

  it("trim: пробелы по краям убираются перед сохранением", async () => {
    const res = await postFeedback(
      { subject: "  Тема  ", text: "  Текст  " },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string };
    const stored = await db.feedback.findUnique({ where: { id: body.id } });
    expect(stored?.subject).toBe("Тема");
    expect(stored?.text).toBe("Текст");
  });

  it("санитизация: HTML вычищается из полей", async () => {
    const res = await postFeedback(
      {
        subject: "<script>alert(1)</script>Тема",
        text: '<b onclick="steal()">Текст</b>',
      },
      `${devMockAccessToken(userId)}`,
    );
    expect(res.status).toBe(201);

    const body = (await res.json()) as { id: string };
    const stored = await db.feedback.findUnique({ where: { id: body.id } });
    expect(stored?.subject).not.toContain("<script>");
    expect(stored?.text).not.toContain("<b");
    expect(stored?.text).toContain("Текст");
  });
});
