import { describe, it, expect, vi, afterEach } from "vitest";
import { feedbackApi } from "../feedback.api";
import { apiClient } from "../client";

/**
 * Юнит-тесты feedbackApi: endpoint, метод, тело запроса и валидация ответа.
 */
describe("feedbackApi.create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /feedback с JSON-телом", async () => {
    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue({ id: "fb-1", createdAt: "2026-08-26T12:00:00.000Z" });

    await feedbackApi.create({ subject: "Тема", text: "Текст обращения" });

    expect(requestSpy).toHaveBeenCalledWith(
      "/feedback",
      {
        method: "POST",
        body: JSON.stringify({ subject: "Тема", text: "Текст обращения" }),
      },
      expect.anything(),
    );
  });

  it("возвращает id и createdAt из ответа", async () => {
    vi.spyOn(apiClient, "request").mockResolvedValue({
      id: "fb-2",
      createdAt: "2026-08-26T13:00:00.000Z",
    });

    const result = await feedbackApi.create({ subject: "Тема", text: "Текст" });

    expect(result.id).toBe("fb-2");
    expect(result.createdAt).toBe("2026-08-26T13:00:00.000Z");
  });

  it("пробрасывает ошибку apiClient", async () => {
    vi.spyOn(apiClient, "request").mockRejectedValue(new Error("Network error"));

    await expect(
      feedbackApi.create({ subject: "Тема", text: "Текст" }),
    ).rejects.toThrow("Network error");
  });
});

describe("feedbackApi.listMine", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /feedback с пробрасыванием signal", async () => {
    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue([]);
    const ac = new AbortController();

    await feedbackApi.listMine(ac.signal);

    expect(requestSpy).toHaveBeenCalledWith(
      "/feedback",
      { signal: ac.signal },
      expect.anything(),
    );
  });

  it("работает без signal", async () => {
    const requestSpy = vi.spyOn(apiClient, "request").mockResolvedValue([]);

    await feedbackApi.listMine();

    expect(requestSpy).toHaveBeenCalledWith(
      "/feedback",
      { signal: undefined },
      expect.anything(),
    );
  });

  it("возвращает массив обращений", async () => {
    const payload = [
      {
        id: "fb-1",
        subject: "Вопрос",
        text: "Текст",
        reply: "Ответ",
        repliedAt: "2026-08-30T12:00:00.000Z",
        createdAt: "2026-08-29T12:00:00.000Z",
      },
      {
        id: "fb-2",
        subject: "Без ответа",
        text: "Текст",
        reply: null,
        repliedAt: null,
        createdAt: "2026-08-30T10:00:00.000Z",
      },
    ];
    vi.spyOn(apiClient, "request").mockResolvedValue(payload);

    const result = await feedbackApi.listMine();
    expect(result).toEqual(payload);
    expect(result).toHaveLength(2);
    expect(result[0].reply).toBe("Ответ");
    expect(result[1].reply).toBeNull();
  });
});
