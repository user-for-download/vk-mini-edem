// mini-app/src/views/HomeView/panels/HomePanel/HomePanel.tsx
import { useCallback, type FC } from "react";
import {
  Banner,
  Button,
  Box,
  Flex,
  Group,
  Header,
  Panel,
  PullToRefresh,
  Search,
  Spacing,
  Title,
} from "@vkontakte/vkui";
import type { Role, Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTripsQuery, useMyTripsQuery } from "@/queries/useTripsQuery";
import { useMyBookingsQuery } from "@/queries/useBookingsQuery";

export interface HomePanelProps {
  id: string;
  role: Role;
  onOpenTrip: (trip: Trip) => void;
  onGoSearch: () => void;
  onOpenCreateTrip: () => void;
}

/**
 * Главная: приветствие, промо и подборка ближайших поездок.
 * Для водителя дополнительно показываем его активную поездку.
 * Для пассажира — его ближайшую активную бронь.
 */
export const HomePanel: FC<HomePanelProps> = ({
  id,
  role,
  onOpenTrip,
  onGoSearch,
  onOpenCreateTrip,
}) => {
  const currentUser = useCurrentUser();

  const {
    data: tripsData,
    isLoading: tripsLoading,
    isFetching: tripsFetching,
    isError: tripsError,
    refetch: refetchTrips,
  } = useTripsQuery();

  const {
    data: myTripsData,
    isLoading: myTripsLoading,
    isFetching: myTripsFetching,
    refetch: refetchMyTrips,
  } = useMyTripsQuery({
    enabled: role === "driver",
  });

  // Брони пассажира — только при активной роли «пассажир»,
  // чтобы не гонять лишний запрос для водителя.
  const {
    data: myBookings,
    isLoading: myBookingsLoading,
    isFetching: myBookingsFetching,
    isError: myBookingsError,
    refetch: refetchMyBookings,
  } = useMyBookingsQuery({
    enabled: role === "passenger",
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      refetchTrips(),
      role === "driver" ? refetchMyTrips() : Promise.resolve(),
      role === "passenger" ? refetchMyBookings() : Promise.resolve(),
    ]);
  }, [refetchTrips, refetchMyTrips, refetchMyBookings, role]);

  const isRefreshing =
    (tripsFetching && !tripsLoading) ||
    (role === "driver" && myTripsFetching && !myTripsLoading) ||
    (role === "passenger" && myBookingsFetching && !myBookingsLoading);

  if (!currentUser) {
    return (
      <Panel id={id}>
        <AppPanelHeader>Едем</AppPanelHeader>
        <Box padding="system">
          <Flex direction="column" gap={12}>
            <TripCardSkeleton />
            <TripCardSkeleton />
          </Flex>
        </Box>
      </Panel>
    );
  }

  const allTrips = tripsData?.items ?? [];

  const nearbyTrips = allTrips
    .filter((trip) => trip.driver.id !== currentUser.id)
    .slice(0, 2);

  const myTrips = myTripsData ?? [];

  // Бэкенд сортирует GET /trips/my по departureAt: desc,
  // поэтому сортируем на клиенте по возрастанию — ближайшая поездка первой.
  const activeOwnTrip =
    myTrips
      .filter((trip) => trip.status === "active")
      .sort((a, b) => {
        const aTime = a.departureAt ? Date.parse(a.departureAt) : 0;
        const bTime = b.departureAt ? Date.parse(b.departureAt) : 0;
        return aTime - bTime;
      })[0] ?? null;

  // Ближайшая активная бронь пассажира (scope: "active" с бэкенда).
  const nextActiveBooking =
    (myBookings ?? [])
      .filter((b) => b.scope === "active")
      .sort((a, b) => {
        const aTime = a.trip.departureAt ? Date.parse(a.trip.departureAt) : 0;
        const bTime = b.trip.departureAt ? Date.parse(b.trip.departureAt) : 0;
        return aTime - bTime;
      })[0] ?? null;

  return (
    <Panel id={id}>
      <AppPanelHeader>Едем</AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
      <Group>
        <Box padding="system">
          <Title level="1" weight="2">
            Привет, {currentUser.name.split(" ")[0]}!
          </Title>
        </Box>

        <Box padding="system" paddingBlockStart={0} onClick={onGoSearch}>
          <Search placeholder="Куда едем? Например, Тверь" disabled value="" />
        </Box>
      </Group>

      {role === "passenger" ? (
        <Group>
          <Banner
            mode="tint"
            title="Едьте дешевле поезда"
            subtitle="Найдите попутчика по своему маршруту уже сегодня"
            actions={
              <Button mode="primary" size="m" onClick={onGoSearch}>
                Найти поездку
              </Button>
            }
          />
        </Group>
      ) : (
        <Group>
          <Banner
            mode="tint"
            title="Едете куда-то за рулём?"
            subtitle="Опубликуйте поездку и возьмите попутчиков, чтобы разделить расходы на бензин"
            actions={
              <Button mode="primary" size="m" onClick={onOpenCreateTrip}>
                Создать поездку
              </Button>
            }
          />
        </Group>
      )}

      {role === "driver" && (
        <Group header={<Header size="s">Ваша активная поездка</Header>}>
          {myTripsLoading && (
            <Box padding="system">
              <TripCardSkeleton />
            </Box>
          )}

          {!myTripsLoading && activeOwnTrip && (
            <Box padding="system">
              <TripCard trip={activeOwnTrip} onOpen={onOpenTrip} />
            </Box>
          )}

          {!myTripsLoading && !activeOwnTrip && (
            <EmptyState
              title="Активных поездок нет"
              subtitle="Создайте поездку, чтобы получать заявки пассажиров"
            />
          )}
        </Group>
      )}

      {role === "passenger" && (
        <Group header={<Header size="s">Ваша активная поездка</Header>}>
          {myBookingsLoading && (
            <Box padding="system">
              <TripCardSkeleton />
            </Box>
          )}

          {myBookingsError && (
            <EmptyState
              title="Не удалось загрузить бронирование"
              subtitle="Проверьте соединение и попробуйте позже"
            />
          )}

          {!myBookingsLoading && !myBookingsError && nextActiveBooking && (
            <Box padding="system">
              <TripCard
                trip={nextActiveBooking.trip}
                onOpen={() => onOpenTrip(nextActiveBooking.trip)}
                hideSeats // Пассажиру важнее его бронь, а не свободные места
              />
            </Box>
          )}

          {!myBookingsLoading && !myBookingsError && !nextActiveBooking && (
            <EmptyState
              title="Нет активных броней"
              subtitle="Найдите поездку и отправьте заявку водителю"
            />
          )}
        </Group>
      )}

      <Group header={<Header size="s">Едут скоро</Header>}>
        {tripsLoading && (
          <Box padding="system">
            <Flex
              direction="column"
              gap={12}
              aria-busy="true"
              aria-label="Загрузка списка поездок"
            >
              <TripCardSkeleton />
              <TripCardSkeleton />
            </Flex>
          </Box>
        )}

        {tripsError && (
          <EmptyState
            title="Не удалось загрузить поездки"
            subtitle="Попробуйте обновить список позже"
            action={
              <Box padding="system">
                <Button size="m" mode="primary" onClick={() => refetchTrips()}>
                  Попробовать снова
                </Button>
              </Box>
            }
          />
        )}

        {!tripsLoading && !tripsError && nearbyTrips.length > 0 && (
          <Box padding="system">
            <Flex direction="column" gap={12}>
              {nearbyTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} onOpen={onOpenTrip} />
              ))}
            </Flex>
          </Box>
        )}

        {!tripsLoading && !tripsError && nearbyTrips.length === 0 && (
          <EmptyState
            title="Пока нет доступных поездок"
            subtitle="Загляните позже или измените параметры поиска"
          />
        )}
      </Group>

      <Spacing size={24} />
      </PullToRefresh>
    </Panel>
  );
};
