import { describe, it, expect, vi, afterEach } from "vitest";
import { citiesApi } from "../cities.api";
import { apiClient } from "../client";

/**
 * Юнит-тесты citiesApi: правильный URL с query-параметрами и проброс
 * Zod-валидации. Реальная серверная фильтрация покрывается
 * интеграционным тестом cities-suggest.test.ts на бэкенде.
 */
describe("citiesApi.suggest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /cities/suggest с query-параметрами q и limit", async () => {
    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue([{ id: "c-1", name: "Вологда" }]);

    const result = await citiesApi.suggest("вол");

    expect(requestSpy).toHaveBeenCalledWith(
      "/cities/suggest?limit=100&q=%D0%B2%D0%BE%D0%BB",
      { signal: undefined },
      expect.anything(),
    );
    expect(result).toEqual([{ id: "c-1", name: "Вологда" }]);
  });

  it("пробрасывает signal для отмены устаревших запросов", async () => {
    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue([]);
    const ctrl = new AbortController();

    await citiesApi.suggest("череп", ctrl.signal);

    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining("/cities/suggest?"),
      { signal: ctrl.signal },
      expect.anything(),
    );
  });

  it("пустой q → загрузка всего справочника одним запросом", async () => {
    const requestSpy = vi
      .spyOn(apiClient, "request")
      .mockResolvedValue([
        { id: "c-1", name: "Вологда" },
        { id: "c-2", name: "Череповец" },
      ]);

    const result = await citiesApi.suggest("");

    expect(requestSpy).toHaveBeenCalledWith(
      "/cities/suggest?limit=100",
      { signal: undefined },
      expect.anything(),
    );
    expect(result).toHaveLength(2);
  });
});
