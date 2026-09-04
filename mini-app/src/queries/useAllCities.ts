import { useQuery } from "@tanstack/react-query";
import { citiesApi } from "@/api/cities.api";
import type { CityDto } from "@edem/contracts";

/**
 * Хук загрузки всего справочника точек. Мини-ап получает полный
 * список (≤ 25 городов) одним запросом и фильтрует локально через
 * `CustomSelect.filterFn`. Это:
 *
 *  - 1 запрос вместо N при наборе;
 *  - мгновенный отклик фильтра без сетевых задержек;
 *  - одинаковая логика с веб-админкой, где весь список тоже грузится.
 *
 * `staleTime: Infinity`: справочник меняется через админку, но
 * поездка — короткоживущий процесс; пользователь успеет выбрать
 * город задолго до того, как сменится справочник. После мутаций
 * формы вызывается `queryClient.invalidateQueries({ queryKey: [...] })`.
 *
 * `gcTime: 30 мин`: после закрытия формы держим кэш на случай
 * повторного открытия.
 */
export const useAllCitiesQuery = () =>
  useQuery<CityDto[]>({
    queryKey: ["cities", "all"],
    queryFn: ({ signal }) => citiesApi.suggest("", signal),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
