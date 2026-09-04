// backend/tests/unit/vkPush.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted: фабрика vi.mock поднимается выше объявления переменных,
// поэтому мутируемый env-объект создаём внутри hoisted.
const { envMock } = vi.hoisted(() => ({
  envMock: { VK_SERVICE_KEY: "test-service-key" } as Record<string, string>,
}));

vi.mock("../../src/env.js", () => ({ env: envMock }));

vi.mock("../../src/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { sendVkPush } = await import("../../src/services/vkPush.js");

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("sendVkPush", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    envMock.VK_SERVICE_KEY = "test-service-key";
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ response: [1] }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("отправляет push с верными параметрами и Bearer-ключом", async () => {
    const result = await sendVkPush(123, "Сообщение");

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.vk.com/method/notifications.sendMessage");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-service-key");

    const body = init.body as URLSearchParams;
    expect(body.get("user_ids")).toBe("123");
    expect(body.get("message")).toBe("Сообщение");
    expect(body.get("v")).toBeTruthy();
    expect(body.get("fragment")).toBeNull();
  });

  it("передаёт fragment для deep-link", async () => {
    await sendVkPush(123, "Сообщение", "/bookings");

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("fragment")).toBe("/bookings");
  });

  it("не отправляет без сервисного ключа (fail-safe)", async () => {
    envMock.VK_SERVICE_KEY = "";

    const result = await sendVkPush(123, "Сообщение");

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("не отправляет при невалидном vkUserId", async () => {
    expect(await sendVkPush(0, "x")).toBe(false);
    expect(await sendVkPush(-1, "x")).toBe(false);
    expect(await sendVkPush(Number.NaN, "x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("возвращает false при ошибке VK API (например, нет разрешения)", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { error_code: 901, error_msg: "denied" } })
    );

    expect(await sendVkPush(123, "x")).toBe(false);
  });

  it("возвращает false при HTTP-ошибке", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 500));

    expect(await sendVkPush(123, "x")).toBe(false);
  });

  it("возвращает false при сетевой ошибке и не бросает исключение", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    expect(await sendVkPush(123, "x")).toBe(false);
  });
});
