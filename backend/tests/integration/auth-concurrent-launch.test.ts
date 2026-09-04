import { afterAll, describe, expect, it, vi } from "vitest";

// Лимитер /auth/vk создаётся при импорте app со значениями из env.
// Поднимаем лимит до импорта модулей, чтобы 60 запросов теста не упирались в 429.
vi.hoisted(() => {
  process.env.VK_AUTH_RATE_WINDOW_MS = "900000";
  process.env.VK_AUTH_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");

/**
 * Регрессия: P2002-гонка при конкурентных VK-запусках (один фикс — commit
 * «fix(auth): P2002 при конкурентных VK-запусках»).
 *
 * Prisma (5.22) генерирует upsert как SELECT по vkUserId → INSERT, а не
 * атомарный INSERT ... ON CONFLICT: при ПУСТОМ update (клиент не прислал
 * аватар с VK CDN — нормальный кейс запуска мини-аппа) у INSERT нет
 * ON CONFLICT. Два конкурентных запуска в одном тике видят «пользователя
 * нет» и оба делают INSERT — второй получал P2002 → 500 у одного из
 * клиентов (тут — детерминированно: до фикса падал в 1-м раунде из 30).
 *
 * Паттерны репо (см. auth-ban-reason.test.ts): app.request(), vi.hoisted
 * для лимитеров, vkUserId из выделенного диапазона (9_800_000+ — не
 * пересекается с другими интеграционными тестами, в т.ч. с 9_700_000+
 * review-unique-null-trip.test.ts).
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

async function cleanDb() {
  await db.review.deleteMany();
  await db.booking.deleteMany();
  await db.trip.deleteMany();
  await db.car.deleteMany();
  await db.user.deleteMany(); // refreshToken — каскадно (onDelete: Cascade)
}

afterAll(async () => {
  await cleanDb();
  await db.$disconnect();
});

describe("auth/vk: concurrent launches (P2002 regression)", () => {
  it("30 tight concurrent rounds, fresh vkUserId each: both 200, exactly one user", async () => {
    for (let i = 0; i < 30; i++) {
      const vkUserId = 9_800_000 + i;
      await db.user.deleteMany({ where: { vkUserId } });

      const requests = await Promise.all(
        Array.from({ length: 2 }, () =>
          app.request("/api/v1/auth/vk", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              searchParams: `vk_user_id=${vkUserId}&sign=dev-sign`,
            }),
          })
        )
      );

      const results = await Promise.all(
        requests.map(async (response) => ({
          status: response.status,
          body: await response.text(),
        }))
      );

      if (results.some((r) => r.status !== 200)) {
        console.error(`concurrent launch round ${i} (${vkUserId}):`, results);
      }

      expect(results.map((r) => r.status)).toEqual([200, 200]);
      const users = await db.user.count({ where: { vkUserId } });
      expect(users).toBe(1);
    }
  }, 60000);
});
