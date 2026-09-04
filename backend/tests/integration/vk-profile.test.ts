import { afterEach, describe, expect, it } from "vitest";

const { app } = await import("../../src/app.js");
const { db } = await import("../../src/db.js");
const { DEFAULT_AVATAR_URL } = await import("../../src/constants.js");

/**
 * Синхронизация отображаемого профиля (имя/фото) из launch-параметров VK
 * при входе через /auth/vk.
 *
 * Поля first_name/last_name/photo НЕ подписаны VK (подпись покрывает только
 * vk_*), поэтому трактуются как display-данные: аватар синхронизируется при
 * каждом входе (через API не редактируется), имя — только пока пользователь
 * не заменил placeholder вручную.
 */
const JSON_HEADERS = { "Content-Type": "application/json" };

// Диапазон vk_user_id, не пересекающийся с сидом и другими тестами.
const BASE_VK_ID = 7_700_000;
const createdVkIds: number[] = [];

function devSearchParams(vkUserId: number, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    vk_user_id: String(vkUserId),
    vk_app_id: "0",
    vk_platform: "desktop_web",
    vk_ts: Math.floor(Date.now() / 1000).toString(),
    sign: "dev-sign",
    ...extra,
  });
  return params.toString();
}

async function loginWithVk(searchParams: string) {
  return app.request("/api/v1/auth/vk", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ searchParams }),
  });
}

async function findUserByVkId(vkUserId: number) {
  return db.user.findUnique({ where: { vkUserId } });
}

afterEach(async () => {
  if (createdVkIds.length > 0) {
    await db.refreshToken.deleteMany({
      where: { user: { vkUserId: { in: createdVkIds } } },
    });
    await db.user.deleteMany({ where: { vkUserId: { in: createdVkIds } } });
    createdVkIds.length = 0;
  }
});

describe("auth/vk: профиль из launch-параметров VK", () => {
  it("новый пользователь: имя и фото берутся из VK", async () => {
    const vkId = BASE_VK_ID + 1;
    createdVkIds.push(vkId);

    const response = await loginWithVk(
      devSearchParams(vkId, {
        first_name: "Иван",
        last_name: "Петров",
        photo: "https://sun9-10.userapi.com/imp/abc.jpg",
      })
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.user.name).toBe("Иван Петров");
    expect(body.user.avatar).toBe("https://sun9-10.userapi.com/imp/abc.jpg");

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Иван Петров");
    expect(user?.avatar).toBe("https://sun9-10.userapi.com/imp/abc.jpg");
  });

  it("без профильных полей: placeholder и аватар по умолчанию", async () => {
    const vkId = BASE_VK_ID + 2;
    createdVkIds.push(vkId);

    const response = await loginWithVk(devSearchParams(vkId));
    expect(response.status).toBe(200);

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe(`Пользователь VK ${vkId}`);
    expect(user?.avatar).toBe(DEFAULT_AVATAR_URL);
  });

  it("повторный вход: аватар синхронизируется с новым фото VK", async () => {
    const vkId = BASE_VK_ID + 3;
    createdVkIds.push(vkId);

    await loginWithVk(
      devSearchParams(vkId, {
        first_name: "Анна",
        photo: "https://sun9-10.userapi.com/old.jpg",
      })
    );
    await loginWithVk(
      devSearchParams(vkId, {
        first_name: "Анна",
        photo: "https://sun9-10.userapi.com/new.jpg",
      })
    );

    const user = await findUserByVkId(vkId);
    expect(user?.avatar).toBe("https://sun9-10.userapi.com/new.jpg");
  });

  it("существующий placeholder-пользователь получает VK-имя при входе", async () => {
    const vkId = BASE_VK_ID + 4;
    createdVkIds.push(vkId);

    // Имитация пользователя, созданного до синхронизации профиля.
    await db.user.create({
      data: {
        vkUserId: vkId,
        name: `Пользователь VK ${vkId}`,
        avatar: DEFAULT_AVATAR_URL,
      },
    });

    await loginWithVk(
      devSearchParams(vkId, {
        first_name: "Ольга",
        last_name: "Смирнова",
        photo: "https://sun9-10.userapi.com/olga.jpg",
      })
    );

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Ольга Смирнова");
    expect(user?.avatar).toBe("https://sun9-10.userapi.com/olga.jpg");
  });

  it("вручную отредактированное имя не перезаписывается", async () => {
    const vkId = BASE_VK_ID + 5;
    createdVkIds.push(vkId);

    await loginWithVk(
      devSearchParams(vkId, { first_name: "Пётр", last_name: "Иванов" })
    );

    // Пользователь сменил имя через PATCH /users/me.
    await db.user.update({
      where: { vkUserId: vkId },
      data: { name: "Кастомное имя" },
    });

    await loginWithVk(
      devSearchParams(vkId, { first_name: "Пётр", last_name: "Иванов" })
    );

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Кастомное имя");
  });

  it("photo без https игнорируется — аватар по умолчанию", async () => {
    const vkId = BASE_VK_ID + 6;
    createdVkIds.push(vkId);

    await loginWithVk(
      devSearchParams(vkId, {
        first_name: "Тест",
        photo: "http://evil.example.com/x.jpg",
      })
    );

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Тест");
    expect(user?.avatar).toBe(DEFAULT_AVATAR_URL);
  });

  it("HTML в имени вычищается sanitize'ом", async () => {
    const vkId = BASE_VK_ID + 7;
    createdVkIds.push(vkId);

    await loginWithVk(
      devSearchParams(vkId, {
        first_name: "<script>alert(1)</script>Иван",
        last_name: "<b>Петров</b>",
      })
    );

    const user = await findUserByVkId(vkId);
    expect(user?.name).not.toContain("<");
    expect(user?.name).toContain("Иван");
    expect(user?.name).toContain("Петров");
  });
});

describe("auth/vk: профильные поля тела запроса (VKWebAppGetUserInfo)", () => {
  async function loginWithProfile(
    vkUserId: number,
    profile: { firstName?: string; lastName?: string; photo?: string }
  ) {
    return app.request("/api/v1/auth/vk", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        searchParams: devSearchParams(vkUserId),
        ...profile,
      }),
    });
  }

  it("поля тела используются для имени и аватара", async () => {
    const vkId = BASE_VK_ID + 11;
    createdVkIds.push(vkId);

    const response = await loginWithProfile(vkId, {
      firstName: "Мария",
      lastName: "Иванова",
      photo: "https://sun9-22.userapi.com/maria.jpg",
    });
    expect(response.status).toBe(200);

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Мария Иванова");
    expect(user?.avatar).toBe("https://sun9-22.userapi.com/maria.jpg");
  });

  it("поля тела в приоритете над launch-параметрами", async () => {
    const vkId = BASE_VK_ID + 12;
    createdVkIds.push(vkId);

    const searchParams = devSearchParams(vkId, {
      first_name: "Старое",
      photo: "https://sun9-10.userapi.com/old.jpg",
    });
    const response = await app.request("/api/v1/auth/vk", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        searchParams,
        firstName: "Новое",
        photo: "https://sun9-10.userapi.com/new.jpg",
      }),
    });
    expect(response.status).toBe(200);

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Новое");
    expect(user?.avatar).toBe("https://sun9-10.userapi.com/new.jpg");
  });

  it("аватар с https, но не с VK CDN — отклоняется", async () => {
    const vkId = BASE_VK_ID + 13;
    createdVkIds.push(vkId);

    await loginWithProfile(vkId, {
      firstName: "Тест",
      photo: "https://evil.example.com/avatar.png",
    });

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Тест");
    expect(user?.avatar).toBe(DEFAULT_AVATAR_URL);
  });

  it("только имя (без фото): аватар по умолчанию", async () => {
    const vkId = BASE_VK_ID + 14;
    createdVkIds.push(vkId);

    await loginWithProfile(vkId, { firstName: "Анна" });

    const user = await findUserByVkId(vkId);
    expect(user?.name).toBe("Анна");
    expect(user?.avatar).toBe(DEFAULT_AVATAR_URL);
  });
});
