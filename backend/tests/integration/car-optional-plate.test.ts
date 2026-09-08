import { afterEach, describe, expect, it, vi } from "vitest";

// Лимиты мутаций читаются из env при импорте — завышаем,
// чтобы тест не упёрся в 429.
vi.hoisted(() => {
  process.env.MUTATION_RATE_WINDOW_MS = "60000";
  process.env.MUTATION_RATE_MAX = "1000";
});

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { signAccessToken } = await import("../../src/auth/tokens.js");

/**
 * Опциональный номер авто (примета, не госномер строго):
 *
 * 1) POST /users/me/car без plate → 200, ключ plate отсутствует в ответе,
 *    в БД хранится null (а не "").
 * 2) POST с plate → 200, номер присутствует в ответе и в БД.
 * 3) POST с plate: "   " → нормализуется в null (200, ключ опущен).
 * 4) Обновление с номером → без номера: plate очищается (null).
 * 5) Валидация остального не ослаблена: без model → 400,
 *    plate длиннее 15 → 400. Без токена → 401.
 *
 * Паттерны репо (см. onboarding.test.ts): app.request(), уникальные
 * vkUserId (INT4-счётчик, диапазон 9_310_000 не пересекается
 * с другими сьютами), чистка созданных пользователей в afterEach.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

const createdUserIds: string[] = [];
let vkSeq = 9_310_000;

async function createUser(): Promise<{ id: string; token: string }> {
  const user = await db.user.create({
    data: {
      name: `CarPlateUser-${vkSeq + 1}`,
      vkUserId: ++vkSeq,
      avatar: "https://i.pravatar.cc/200?img=11",
    },
  });
  createdUserIds.push(user.id);
  const token = await signAccessToken(user.id);
  return { id: user.id, token };
}

function postCar(token: string | null, body: unknown) {
  return app.request("/api/v1/users/me/car", {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
  }
});

describe("POST /users/me/car — опциональный plate", () => {
  it("создаёт авто без номера (200, ключ plate опущен, в БД null)", async () => {
    // Arrange
    const { id, token } = await createUser();

    // Act
    const res = await postCar(token, { model: "Lada", color: "белый" });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { car?: { plate?: string } };
    expect(body.car).toBeDefined();
    expect(body.car).not.toHaveProperty("plate");
    const dbCar = await db.car.findUnique({ where: { userId: id } });
    expect(dbCar?.plate).toBeNull();
  });

  it("создаёт авто с номером (200, plate в ответе и в БД)", async () => {
    // Arrange
    const { id, token } = await createUser();

    // Act
    const res = await postCar(token, {
      model: "Lada",
      color: "белый",
      plate: "583",
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { car?: { plate?: string } };
    expect(body.car?.plate).toBe("583");
    const dbCar = await db.car.findUnique({ where: { userId: id } });
    expect(dbCar?.plate).toBe("583");
  });

  it("пробельный номер нормализуется в null (200, ключ опущен)", async () => {
    // Arrange
    const { id, token } = await createUser();

    // Act
    const res = await postCar(token, {
      model: "Lada",
      color: "белый",
      plate: "   ",
    });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { car?: { plate?: string } };
    expect(body.car).not.toHaveProperty("plate");
    const dbCar = await db.car.findUnique({ where: { userId: id } });
    expect(dbCar?.plate).toBeNull();
  });

  it("обновление стирает номер: с plate → без plate (200, в БД null)", async () => {
    // Arrange
    const { id, token } = await createUser();
    const first = await postCar(token, {
      model: "Lada",
      color: "белый",
      plate: "583",
    });
    expect(first.status).toBe(200);

    // Act
    const res = await postCar(token, { model: "Lada", color: "белый" });

    // Assert
    expect(res.status).toBe(200);
    const body = (await res.json()) as { car?: { plate?: string } };
    expect(body.car).not.toHaveProperty("plate");
    const dbCar = await db.car.findUnique({ where: { userId: id } });
    expect(dbCar?.plate).toBeNull();
  });

  it("валидация остального не ослаблена: без model → 400, plate > 15 → 400", async () => {
    // Arrange
    const { token } = await createUser();

    // Act
    const noModel = await postCar(token, { color: "белый" });
    const longPlate = await postCar(token, {
      model: "Lada",
      color: "белый",
      plate: "x".repeat(16),
    });

    // Assert
    expect(noModel.status).toBe(400);
    expect(longPlate.status).toBe(400);
  });

  it("без токена → 401", async () => {
    // Act
    const res = await postCar(null, { model: "Lada", color: "белый" });

    // Assert
    expect(res.status).toBe(401);
  });
});
