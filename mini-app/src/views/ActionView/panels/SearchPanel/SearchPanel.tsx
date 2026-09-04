// mini-app/src/views/ActionView/panels/SearchPanel/SearchPanel.tsx
import { useEffect, useMemo, useState, useRef, type FC } from "react";
import { Accordion, Box, Button, Card, Caption, DateInput, Flex, Group, Panel, PullToRefresh, Search, Spacing } from "@vkontakte/vkui";
import type { Trip } from "@/types";
import type { TripTag } from "@edem/contracts";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { TagsScroll } from "@/components/TagsScroll";
import { TRIP_TAGS } from "@/consts/tags";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInfiniteTripsQuery } from "@/queries/useTripsQuery";
import type { SearchTripsFilters } from "@/api/trips.api";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { filterTripsForUser, shouldFetchMoreTrips } from "@/helpers/tripSearch";

export interface SearchPanelProps {
  id: string;
  onOpenTrip: (trip: Trip) => void;
}

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

  return {
    q: trimmed,
  };
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const SearchPanel: FC<SearchPanelProps> = ({ id, onOpenTrip }) => {
  const currentUser = useCurrentUser();

  const [searchValue, setSearchValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<TripTag[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const debouncedSearchValue = useDebouncedValue(searchValue, 400);

  const filters = useMemo(() => {
    const parsedFilters = parseSearchQuery(debouncedSearchValue);
    const result: SearchTripsFilters = { ...parsedFilters };
    if (selectedTags.length > 0) result.tags = selectedTags;
    if (dateFrom) result.dateFrom = toDateString(dateFrom);
    if (dateTo) result.dateTo = toDateString(dateTo);
    return Object.keys(result).length > 0 ? result : undefined;
  }, [debouncedSearchValue, selectedTags, dateFrom, dateTo]);

  const {
    data, isLoading, isError, error, refetch, isFetchingNextPage, hasNextPage, fetchNextPage,
  } = useInfiniteTripsQuery(filters);

  const { isRefreshing, handleRefresh } = usePullToRefresh(refetch);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // При ошибке запроса не догружаем страницы: иначе observer будет
        // бесконечно перезапускать неудачный fetchNextPage.
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage && !isError) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const results = useMemo(() => {
    const trips = data?.pages.flatMap((page) => page.items) ?? [];
    return filterTripsForUser(trips, currentUser?.id);
  }, [data, currentUser?.id]);

  // Свои поездки отфильтровываются на клиенте ПОСЛЕ пагинации: если первая
  // страница целиком состоит из поездок текущего пользователя, догружаем
  // следующие страницы, пока не найдём чужие поездки или не закончатся.
  // При ошибке запроса автодогрузка останавливается (иначе бесконечный цикл).
  useEffect(() => {
    if (
      !isError &&
      shouldFetchMoreTrips(
        results.length,
        Boolean(hasNextPage),
        isFetchingNextPage
      )
    ) {
      fetchNextPage();
    }
  }, [results.length, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return (
    <Panel id={id}>
      <AppPanelHeader>Поиск поездок</AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <div>
      <Group>
        <Box padding="system" >
          <Search
            placeholder="Откуда — куда"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
                      </Box>
        <Box padding="system" paddingBlockStart={0}>
          <TagsScroll tags={TRIP_TAGS} selected={selectedTags} onChange={(next) => setSelectedTags(next as TripTag[])} />
                                                  </Box>
        {/* Такая же карточка, как у поездок в списке. Отступы явные,
            в пикселях — не зависят от theme-токенов VKUI */}
        <Box padding={16} paddingBlockStart={0}>
          <Card mode="outline">
            <Accordion defaultExpanded={false}>
              <Accordion.Summary>
                Выбор даты
              </Accordion.Summary>
                                  <Accordion.Content>
                <Box padding={16} paddingBlockStart={4}>
                  <Flex gap={8}>
                    <Flex direction="column" gap={4} style={{ flex: 1 }}>
                      <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>Дата от</Caption>
                      <DateInput
                        value={dateFrom}
                        onChange={setDateFrom}
                        disablePast
                        placeholder="Не выбрано"
                      />
                    </Flex>
                    <Flex direction="column" gap={4} style={{ flex: 1 }}>
                      <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>Дата до</Caption>
                      <DateInput
                        value={dateTo}
                        onChange={setDateTo}
                        disablePast
                        minDateTime={dateFrom ?? undefined}
                        placeholder="Не выбрано"
                      />
                    </Flex>
                  </Flex>
                  {(dateFrom || dateTo) && (
                    <Spacing size={8} />
                  )}
                  {(dateFrom || dateTo) && (
                    <Button
                      size="s"
                      mode="tertiary"
                      appearance="neutral"
                      onClick={() => {
                        setDateFrom(null);
                        setDateTo(null);
                      }}
                    >
                      Сбросить даты
                    </Button>
                  )}
                </Box>
              </Accordion.Content>
            </Accordion>
          </Card>
        </Box>
      </Group>

      <Group>
        {isLoading && results.length === 0 && (
          <Box padding="system">
            <Flex
              direction="column"
              gap={12}
              aria-busy="true"
              aria-label="Загрузка списка поездок"
            >
              <TripCardSkeleton />
              <TripCardSkeleton />
              <TripCardSkeleton />
            </Flex>
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

        {/* Как и в TripsManagePanel: при ошибке список с sentinel-элементом
            размонтируется, чтобы observer не перезапускал запрос. */}
        {!isError && results.length > 0 && (
          <Box padding="system">
            <Flex direction="column" gap={12} aria-busy={isFetchingNextPage}>
              {results.map((trip) => (
                <TripCard key={trip.id} trip={trip} onOpen={onOpenTrip} />
              ))}
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {isFetchingNextPage && <TripCardSkeleton />}
            </Flex>
          </Box>
        )}

        {!isLoading && !isError && results.length === 0 && !hasNextPage && (
          <EmptyState
            title="Ничего не нашлось"
            subtitle="Попробуйте изменить маршрут или поискать другой город"
          />
        )}
      </Group>

      <Spacing size={24} />
      </div>
      </PullToRefresh>
    </Panel>
  );
};
