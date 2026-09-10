import { useState } from "react";
import { Button, Input, List, Section } from "@telegram-apps/telegram-ui";
import { PageHeader } from "@/components/PageHeader";
import { QueryState } from "@/components/QueryState";
import { TripCard } from "@/components/TripCard";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TRIP_TAGS } from "@/consts/tags";
import {
  EMPTY_SEARCH_FORM,
  buildSearchFilters,
  type SearchFormState,
} from "@/helpers/searchFilters";
import { useInfiniteTripsQuery } from "@/queries/useTripsQuery";
import type { TripTag } from "@edem/contracts";

/**
 * Поиск поездок (паритет VK SearchPanel): свободная строка с разбором
 * «Откуда → Куда», явные города, даты, цена и теги. Пустые фильтры —
 * общая лента (бэкенд скрывает уехавшие: departureAt > now).
 */
export function SearchPage() {
  const [form, setForm] = useState<SearchFormState>(EMPTY_SEARCH_FORM);
  const [submitted, setSubmitted] = useState<SearchFormState>(EMPTY_SEARCH_FORM);
  const trips = useInfiniteTripsQuery(buildSearchFilters(submitted));
  const items = trips.data?.pages.flatMap((page) => page.items) ?? [];

  const set = <K extends keyof SearchFormState>(key: K, value: SearchFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTag = (tag: TripTag) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((item) => item !== tag)
        : [...prev.tags, tag],
    }));

  const reset = () => {
    setForm(EMPTY_SEARCH_FORM);
    setSubmitted(EMPTY_SEARCH_FORM);
  };

  return (
    <>
      <PageHeader title="Найти поездку" action={{ label: "Ищу попутку", to: "/ride-requests" }} />
      <OfflineBanner />
      <Section>
        <List>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(form);
            }}
          >
            <label className="FormField" htmlFor="trip-search">
              Направление
              <Input
                id="trip-search"
                value={form.query}
                onChange={(event) => set("query", event.target.value)}
                placeholder="Город, адрес или «Москва → Тула»"
                type="search"
              />
            </label>
            <div className="ButtonRow">
              <Button stretched type="submit">
                Найти
              </Button>
              <Button mode="plain" stretched type="button" onClick={reset}>
                Сбросить
              </Button>
            </div>
            <label className="FormField">
              Откуда (город)
              <Input
                value={form.fromCity}
                onChange={(event) => set("fromCity", event.target.value)}
                placeholder="Город отправления"
              />
            </label>
            <label className="FormField">
              Куда (город)
              <Input
                value={form.toCity}
                onChange={(event) => set("toCity", event.target.value)}
                placeholder="Город назначения"
              />
            </label>
            <label className="FormField">
              Дата от
              <Input
                type="date"
                value={form.dateFrom}
                onChange={(event) => set("dateFrom", event.target.value)}
              />
            </label>
            <label className="FormField">
              Дата до
              <Input
                type="date"
                value={form.dateTo}
                onChange={(event) => set("dateTo", event.target.value)}
              />
            </label>
            <label className="FormField">
              Цена до, ₽
              <Input
                type="number"
                min="1"
                value={form.maxPrice}
                onChange={(event) => set("maxPrice", event.target.value)}
                placeholder="Любая"
              />
            </label>
            <fieldset className="FormField">
              <legend>Особенности</legend>
              {TRIP_TAGS.map((tag) => (
                <label key={tag}>
                  <input
                    type="checkbox"
                    checked={form.tags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                  />
                  {tag}
                </label>
              ))}
            </fieldset>
          </form>
        </List>
      </Section>
      <QueryState loading={trips.isLoading} error={trips.error} empty={!items.length} emptyText="Измените город, дату или фильтры поиска." onRetry={() => void trips.refetch()}>
        <List>{items.map((trip) => <TripCard key={trip.id} trip={trip} />)}</List>
        {trips.hasNextPage && <Button stretched onClick={() => void trips.fetchNextPage()} disabled={trips.isFetchingNextPage}>Показать ещё</Button>}
      </QueryState>
    </>
  );
}
