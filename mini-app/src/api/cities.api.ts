import { apiClient } from "./client";
import { citySuggestResponseSchema } from "@edem/contracts";
import type { CityDto } from "@edem/contracts";

/**
 * Локальная Zod-схема ответа `GET /cities/suggest` повторно использует
 * контракт из `@edem/contracts`. Парсинг через apiClient гарантирует,
 * что фронт не получит «неожиданный» JSON при изменении API.
 */
const suggestResponseSchema = citySuggestResponseSchema;

export const citiesApi = {
  /**
   * Загрузка справочника точек. Мини-ап передаёт пустой `q` и
   * получает весь список (≤ 25 городов) одним запросом; фильтрация
   * выполняется локально через `CustomSelect.filterFn`.
   *
   * `signal` нужен, чтобы TanStack Query отменял устаревшие запросы
   * (хотя наш `useAllCitiesQuery` шлёт ровно один — это требование
   * обратной совместимости и чистоты API).
   */
  suggest: (q: string, signal?: AbortSignal): Promise<CityDto[]> => {
    const params = new URLSearchParams({ limit: "100" });
    if (q) params.set("q", q);
    return apiClient.request<CityDto[]>(
      `/cities/suggest?${params.toString()}`,
      { signal },
      suggestResponseSchema.transform((r) => r.items),
    );
  },
};
