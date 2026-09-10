import {
  citySuggestResponseSchema,
  type CityDto,
} from "@edem/contracts";
import { apiClient } from "./client";

export const citiesApi = {
  suggest: (q: string, signal?: AbortSignal): Promise<CityDto[]> => {
    const query = new URLSearchParams({ limit: "100" });
    if (q) query.set("q", q);

    return apiClient.request(
      `/cities/suggest?${query.toString()}`,
      { signal },
      citySuggestResponseSchema.transform(({ items }) => items),
    );
  },
};
