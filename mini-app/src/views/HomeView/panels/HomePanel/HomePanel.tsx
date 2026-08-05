// mini-app/src/views/HomeView/panels/HomePanel/HomePanel.tsx
import type { FC } from "react";
import {
  Banner,
  Button,
  Box,
  Group,
  Header,
  Panel,
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
    isError: tripsError,
    refetch: refetchTrips,
  } = useTripsQuery();

  const {
    data: myTripsData,
    isLoading: myTripsLoading,
  } = useMyTripsQuery({
    enabled: role === "driver",
  });

  if (!currentUser) {
    return (
      <Panel id={id}>
        <AppPanelHeader>Едем</AppPanelHeader>
        <Box padding="system" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <TripCardSkeleton />
          <TripCardSkeleton />
        </Box>
      </Panel>
    );
  }

  const allTrips = tripsData?.items ?? [];

  const nearbyTrips = allTrips
    .filter((trip) => trip.driver.id !== currentUser.id)
    .slice(0, 2);

  const myTrips = myTripsData ?? [];

  const activeOwnTrip =
    myTrips.find((trip) => trip.status === "active") ?? null;

  return (
    <Panel id={id}>
      <AppPanelHeader>Едем</AppPanelHeader>

      <Group>
        <Box padding="system">
          <Title level="1" weight="2">
            Привет, {currentUser.name.split(" ")[0]}!
          </Title>
        </Box>

        <Box padding="system" style={{ paddingTop: 0 }} onClick={onGoSearch}>
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

      <Group header={<Header size="s">Едут скоро</Header>}>
        {tripsLoading && (
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
            aria-busy="true"
            aria-label="Загрузка списка поездок"
          >
            <TripCardSkeleton />
            <TripCardSkeleton />
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
          <Box
            padding="system"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            {nearbyTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} onOpen={onOpenTrip} />
            ))}
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
    </Panel>
  );
};
