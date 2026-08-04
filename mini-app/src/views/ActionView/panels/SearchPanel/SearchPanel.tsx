// mini-app/src/views/ActionView/panels/SearchPanel/SearchPanel.tsx
import { useEffect, useMemo, useState, type FC } from "react";
import { Box, Button, Group, Header, Panel, Search, Spacing } from "@vkontakte/vkui";
import type { Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTripsQuery } from "@/queries/useTripsQuery";
import type { SearchTripsFilters } from "@/api/trips.api";

export interface SearchPanelProps {
  id: string;
  onOpenTrip: (trip: Trip) => void;
}

/**
 * Ищем разделитель маршрута.
 *
 * Поддерживаем:
 * - стрелку: Москва → Тула
 * - тире/длинное тире с пробелами: Москва - Тула, Москва — Тула
 *
 * Важно: обычный дефис без пробелов не считаем разделителем,
 * чтобы не ломать названия городов вроде «Санкт-Петербург».
 */
const ROUTE_SEPARATOR_REGEX = /→|\s+[-—–]\s+/;

function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

function parseSearchQuery(raw: string): SearchTripsFilters {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {};
  }

  /**
   * Если пользователь ввел маршрут с разделителем,
   * разделяем на fromCity и toCity.
   */
  if (ROUTE_SEPARATOR_REGEX.test(trimmed)) {
    const normalized = trimmed.replace(/\s+[-—–]\s+/g, "→");
    const parts = normalized.split("→").map((part) => part.trim());

    const fromCity = parts[0] || undefined;
    const toCity = parts[1] || undefined;

    const filters: SearchTripsFilters = {};

    if (fromCity) {
      filters.fromCity = fromCity;
    }

    if (toCity) {
      filters.toCity = toCity;
    }

    return filters;
  }

  /**
   * Если разделителя нет, отправляем единый поисковый запрос q.
   *
   * Например:
   * - Москва
   * - Санкт-Петербург
   * - м. Тёплый Стан
   */
  return {
    q: trimmed,
  };
}

/**
 * Реальный поиск поездок через GET /api/trips.
 *
 * Поддерживает:
 * - пустой запрос: показывает все активные поездки;
 * - одиночный запрос: отправляет q;
 * - маршрут с разделителем: отправляет fromCity/toCity.
 */
export const SearchPanel: FC<SearchPanelProps> = ({ id, onOpenTrip }) => {
  const currentUser = useCurrentUser();

  const [searchValue, setSearchValue] = useState("");

  const debouncedSearchValue = useDebouncedValue(searchValue, 400);

  const filters = useMemo(() => {
    const parsedFilters = parseSearchQuery(debouncedSearchValue);

    if (Object.keys(parsedFilters).length === 0) {
      return undefined;
    }

    return parsedFilters;
  }, [debouncedSearchValue]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useTripsQuery(filters);

  const results = useMemo(() => {
    const trips = data ?? [];

    /**
     * Исключаем собственные поездки текущего пользователя,
     * если он является водителем.
     */
    return trips.filter((trip) => trip.driver.id !== currentUser.id);
  }, [data, currentUser.id]);

  return (
    <Panel id={id}>
      <AppPanelHeader>Поиск поездок</AppPanelHeader>

      <Group>
        <Box padding="system">
          <Search
            placeholder="Откуда — куда"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </Box>
      </Group>

      <Group
        header={
          !isLoading && !isError ? (
            <Header size="s">
              {isFetching ? "Ищем поездки..." : `Найдено поездок: ${results.length}`}
            </Header>
          ) : undefined
        }
      >
        {isLoading && results.length === 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy="true"
            aria-label="Загрузка списка поездок"
          >
            <TripCardSkeleton />
            <TripCardSkeleton />
            <TripCardSkeleton />
          </Box>
        )}

        {isError && (
          <EmptyState
            title="Не удалось загрузить поездки"
            subtitle={
              error instanceof Error
                ? error.message
                : "Попробуйте обновить список позже"
            }
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={() => refetch()}>
                  Попробовать снова
                </Button>
              </Box>
            }
          />
        )}

        {!isLoading && !isError && results.length > 0 && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy={isFetching}
          >
            {results.map((trip) => (
              <TripCard key={trip.id} trip={trip} onOpen={onOpenTrip} />
            ))}
          </Box>
        )}

        {!isLoading && !isError && results.length === 0 && (
          <EmptyState
            title="Ничего не нашлось"
            subtitle="Попробуйте изменить маршрут или поискать другой город"
          />
        )}
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};

