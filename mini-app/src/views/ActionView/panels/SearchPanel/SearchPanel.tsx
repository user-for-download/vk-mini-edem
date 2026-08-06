import { useCallback, useEffect, useMemo, useState, useRef, type FC } from "react";
import { Box, Button, Caption, Flex, Group, Input, Panel, PullToRefresh, Search, Spacing } from "@vkontakte/vkui";
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

export const SearchPanel: FC<SearchPanelProps> = ({ id, onOpenTrip }) => {
  const currentUser = useCurrentUser();

  const [searchValue, setSearchValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<TripTag[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearchValue = useDebouncedValue(searchValue, 400);

  const filters = useMemo(() => {
    const parsedFilters = parseSearchQuery(debouncedSearchValue);
    const result: SearchTripsFilters = { ...parsedFilters };
    if (selectedTags.length > 0) result.tags = selectedTags;
    if (dateFrom) result.dateFrom = dateFrom;
    if (dateTo) result.dateTo = dateTo;
    return Object.keys(result).length > 0 ? result : undefined;
  }, [debouncedSearchValue, selectedTags, dateFrom, dateTo]);

  const {
    data, isLoading, isError, error, refetch, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage,
  } = useInfiniteTripsQuery(filters);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const results = useMemo(() => {
    const trips = data?.pages.flatMap((page) => page.items) ?? [];
    return trips.filter((trip) => trip.driver.id !== currentUser?.id);
  }, [data, currentUser?.id]);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const isRefreshing = isFetching && !isLoading;

  return (
    <Panel id={id}>
      <AppPanelHeader>Поиск поездок</AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <Group>
        <Box padding="system">
          <Search
            placeholder="Откуда — куда"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </Box>
        <Box padding="system" paddingBlockStart={0}>
          <TagsScroll tags={TRIP_TAGS} selected={selectedTags} onChange={(next) => setSelectedTags(next as TripTag[])} />
        </Box>
        <Box padding="system" paddingBlockStart={0}>
          <Button size="s" mode="tertiary" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? "Скрыть фильтры" : "Больше фильтров"}
          </Button>
        </Box>
        {showFilters && (
          <Box padding="system" paddingBlockStart={0}>
            <Flex gap={8}>
              <div className="SearchPanel__field">
                <Caption level="1" className="SearchPanel__fieldLabel">Дата от</Caption>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div className="SearchPanel__field">
                <Caption level="1" className="SearchPanel__fieldLabel">Дата до</Caption>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </Flex>
          </Box>
        )}
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

        {results.length > 0 && (
          <Box padding="system">
            <Flex direction="column" gap={12} aria-busy={isFetching}>
              {results.map((trip) => (
                <TripCard key={trip.id} trip={trip} onOpen={onOpenTrip} />
              ))}
              <div ref={sentinelRef} className="SearchPanel__sentinel" />
              {isFetchingNextPage && <TripCardSkeleton />}
            </Flex>
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
      </PullToRefresh>
    </Panel>
  );
};

