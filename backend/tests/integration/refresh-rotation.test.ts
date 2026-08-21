import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeJwt } from "jose";

// Лимитер /auth/refresh создаётся при импорте app со значениями из env.
// Поднимаем лимит до импорта модулей, чтобы тест не упирался в 429.
vi.hoisted(() => {
  process.env.REFRESH_RATE_WINDOW_MS = "900000";
  process.env.REFRESH_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { signRefreshToken, hashToken } = await import("../../src/auth/tokens.js");

/**
 * Ротация refresh-токенов: атомарность и reuse detection.
 *
 * Регрессия TOCTOU-гонки: до исправления rotateRefreshToken читал revokedAt
 * и затем обновлял строку отдельными операциями под Read Committed — две
 * параллельные ротации одного токена обе проходили проверку и выдавали по
 * новому активному токену. Теперь отзыв — один UPDATE с предикатом
 * `revokedAt IS NULL`: из N конкурентов ровно один получает count === 1.
 *
 * Reuse detection: предъявление уже ротированного токена на /auth/refresh
 * отзывает ВСЕ активные токены пользователя (token family revocation).
 * Повторный /auth/logout тем же токеном семью НЕ отзывает.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

const createdUserIds: string[] = [];

async function createUser(seq: number): Promise<string> {
  const user = await db.user.create({
    data: {
      name: `RefreshUser-${seq}`,
      vkUserId: 3_300_000 + seq,
      avatar: "https://i.pravatar.cc/200?img=7",
    },
  });
  createdUserIds.push(user.id);
  return user.id;
}

function getJti(token: string): string {
  const jti = decodeJwt(token).jti;
  if (typeof jti !== "string") {
    throw new Error("refresh token has no jti");
  }
  return jti;
}

async function postRefresh(refreshToken: string) {
  return app.request("/api/v1/auth/refresh", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ refreshToken }),
  });
}

async function postLogout(refreshToken: string) {
  return app.request("/api/v1/auth/logout", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ refreshToken }),
  });
}

async function countActiveTokens(userId: string): Promise<number> {
  return db.refreshToken.count({ where: { userId, revokedAt: null } });
}

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.refreshToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("refresh token rotation", () => {
  it("concurrent rotations of one token mint exactly one successor", async () => {
    const userId = await createUser(1);

    for (let round = 0; round < 5; round++) {
      const token = await signRefreshToken(userId);
      const jti = getJti(token);

      const [first, second] = await Promise.allSettled([
        postRefresh(token),
        postRefresh(token),
      ]);

      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("fulfilled");
      if (first.status !== "fulfilled" || second.status !== "fulfilled") return;

      const statuses = [first.value.status, second.value.status].sort();
      // Регрессия #1: ровно одна ротация успешна. До исправления обе могли
      // вернуть 200 и выдать два активных токена (TOCTOU под Read Committed).
      expect(statuses).toEqual([200, 401]);

      // Старый токен всегда отозван.
      const oldRow = await db.refreshToken.findUnique({
        where: { tokenHash: hashToken(jti) },
      });
      expect(oldRow?.revokedAt).not.toBeNull();

      // Никогда не больше одного активного токена. Если запросы
      // сериализуются, проигравший попадает в reuse detection и отзывает
      // семью (тогда 0); если перекрываются — остаётся токен победителя (1).
      expect(await countActiveTokens(userId)).toBeLessThanOrEqual(1);

      // Следующий раунд стартует с единственным активным токеном.
      await db.refreshToken.deleteMany({ where: { userId } });
    }
  });

  it("replaying a rotated token revokes the whole token family", async () => {
    const userId = await createUser(2);
    const oldToken = await signRefreshToken(userId);

    const rotateRes = await postRefresh(oldToken);
    expect(rotateRes.status).toBe(200);
    const { refreshToken: newToken } = (await rotateRes.json()) as {
      refreshToken: string;
    };
    expect(await countActiveTokens(userId)).toBe(1);

    // Reuse старого токена: 401 + отзыв всей семьи (включая новый токен).
    const reuseRes = await postRefresh(oldToken);
    expect(reuseRes.status).toBe(401);
    expect(await countActiveTokens(userId)).toBe(0);

    const newTokenRes = await postRefresh(newToken);
    expect(newTokenRes.status).toBe(401);
  });

  it("double logout does not revoke the token family", async () => {
    const userId = await createUser(3);
    const oldToken = await signRefreshToken(userId);

    const rotateRes = await postRefresh(oldToken);
    expect(rotateRes.status).toBe(200);
    const { refreshToken: newToken } = (await rotateRes.json()) as {
      refreshToken: string;
    };

    // Повторный logout старым токеном безопасен и не трогает новую сессию.
    expect((await postLogout(oldToken)).status).toBe(200);
    expect((await postLogout(oldToken)).status).toBe(200);
    expect(await countActiveTokens(userId)).toBe(1);

    expect((await postRefresh(newToken)).status).toBe(200);
  });
});
