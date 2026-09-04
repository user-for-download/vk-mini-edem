import type { FC } from "react";
import { Avatar, Button, Caption, Box, Flex, Group, Header, InfoRow, Panel, SimpleCell, SimpleGrid, Spacing, Text, Title } from "@vkontakte/vkui";
import {
  Icon24CarOutline,
  Icon24MessageStarsOutline,
  Icon24DocumentOutline,
  Icon24ServicesOutline,
  Icon24StarsOutline,
  Icon24NotificationOutline,
  Icon24HelpOutline,
  Icon24InfoCircleOutline,
} from "@vkontakte/icons";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import type { Role, Trip } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { resolveAvatar } from "@/helpers/avatar";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAvailableReviewTripsQuery } from "@/queries/useReviewsQuery";

export interface ProfilePanelProps {
  id: string;
  role: Role;
  onChangeRole: (role: Role) => void;
  onOpenReviewForTrip?: (trip: Trip) => void;
  onOpenCarForm?: () => void;
  onOpenEditProfile?: () => void;
  onOpenMyBookings?: () => void;
  onOpenHistory?: () => void;
  onOpenNotifications: () => void;
  onOpenSupport: () => void;
  onOpenAbout: () => void;
}

export const ProfilePanel: FC<ProfilePanelProps> = ({
  id,
  role,
  onChangeRole,
  onOpenReviewForTrip,
  onOpenCarForm,
  onOpenEditProfile,
  onOpenMyBookings,
  onOpenHistory,
  onOpenNotifications,
  onOpenSupport,
  onOpenAbout,
}) => {
  const currentUser = useCurrentUser();
  const routeNavigator = useRouteNavigator();

  const {
    data: availableReviewTrips,
    isLoading: availableReviewTripsLoading,
    isError: availableReviewTripsError,
    error: availableReviewTripsFetchError,
    refetch: refetchAvailableReviewTrips,
  } = useAvailableReviewTripsQuery();

  if (!currentUser) {
    return (
      <Panel id={id}>
        <AppPanelHeader>Профиль</AppPanelHeader>
        <Box padding="system"><Text>Загрузка профиля...</Text></Box>
      </Panel>
    );
  }



  return (
    <Panel id={id}>
      <AppPanelHeader>Профиль</AppPanelHeader>
      <Group>
        <Spacing size={12} />
        <Flex direction="column" align="center" gap={12}>
          <Avatar src={resolveAvatar(currentUser.avatar)} size={80} />
          <Title level="2" weight="2">
            {currentUser.name}
          </Title>
          <RatingBadge value={currentUser.rating} reviewsCount={currentUser.reviewsCount} />
          <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
            Личность подтверждена ВКонтакте
          </Caption>
          <Spacing size={4} />
          <Button mode="secondary" size="m" onClick={onOpenEditProfile}>
            Редактировать
          </Button>
        </Flex>
        <Spacing size={16} />

        <Box padding="system">
          <SimpleGrid columns={2} gap={12}>
            <InfoRow header="Поездок совершено">{currentUser.tripsCount}</InfoRow>
            <InfoRow header="На сервисе с">
              {currentUser.createdAt
                ? new Date(currentUser.createdAt).getFullYear()
                : "—"}
            </InfoRow>
          </SimpleGrid>
        </Box>

        <Box padding="system">
          <RoleSwitcher role={role} onChange={onChangeRole} />
        </Box>
      </Group>

      {role === "driver" && (
        <Group header={<Header size="s">автомобиль</Header>}>
          {currentUser.car ? (
            <SimpleCell
              before={<Icon24CarOutline />}
              chevron="always"
              onClick={onOpenCarForm}
              subtitle={`${currentUser.car.color} · ${currentUser.car.plate}`}
            >
              {currentUser.car.model}
            </SimpleCell>
          ) : (
            <SimpleCell
              before={<Icon24CarOutline />}
              chevron="always"
              onClick={onOpenCarForm}
              subtitle="Чтобы публиковать поездки, добавьте автомобиль"
            >
              Добавить автомобиль
            </SimpleCell>
          )}
        </Group>
      )}

      <Group header={<Header size="s">поездки для отзыва</Header>}>
        {availableReviewTripsLoading && (
          <SimpleCell before={<Icon24StarsOutline />} subtitle="Ищем завершенные поездки">
            Загрузка...
          </SimpleCell>
        )}

        {availableReviewTripsError && (
          <SimpleCell
            before={<Icon24StarsOutline />}
            subtitle={
              availableReviewTripsFetchError instanceof Error
                ? availableReviewTripsFetchError.message
                : "Проверьте соединение и попробуйте позже"
            }
            after={
              <Button
                size="s"
                mode="tertiary"
                onClick={() => { void refetchAvailableReviewTrips(); }}
              >
                Попробовать снова
              </Button>
            }
          >
            Не удалось загрузить поездки
          </SimpleCell>
        )}

        {!availableReviewTripsLoading &&
          !availableReviewTripsError &&
          (availableReviewTrips ?? []).length === 0 && (
            <SimpleCell before={<Icon24StarsOutline />}>
              Нет доступных поездок для отзыва
            </SimpleCell>
          )}

        {!availableReviewTripsLoading &&
          !availableReviewTripsError &&
          (availableReviewTrips ?? []).map((trip) => (
            <SimpleCell
              key={trip.id}
              before={<Icon24StarsOutline />}
              chevron="always"
              onClick={() => onOpenReviewForTrip?.(trip)}
              subtitle={`${trip.date} · ${trip.time}`}
            >
              {trip.fromCity} → {trip.toCity}
            </SimpleCell>
          ))}
      </Group>

      <Group header={<Header size="s">поездки и бронирования</Header>}>
        {role === "driver" && (
          <SimpleCell
            before={<Icon24CarOutline />}
            chevron="always"
            onClick={() => routeNavigator.push("/trips/my")}
          >
            Мои поездки
          </SimpleCell>
        )}
        {role === "passenger" && (
          <SimpleCell
            before={<Icon24DocumentOutline />}
            chevron="always"
            onClick={() => (onOpenMyBookings ? onOpenMyBookings() : routeNavigator.push("/bookings"))}
          >
            Мои брони
          </SimpleCell>
        )}
        {role === "passenger" && (
          <SimpleCell
            before={<Icon24ServicesOutline />}
            chevron="always"
            onClick={() => (onOpenHistory ? onOpenHistory() : routeNavigator.push("/bookings/history"))}
          >
            История поездок
          </SimpleCell>
        )}
        <SimpleCell
          before={<Icon24MessageStarsOutline />}
          chevron="always"
          onClick={() => routeNavigator.push("/profile/reviews")}
        >
          Отзывы
        </SimpleCell>
      </Group>

      <Group header={<Header size="s">настройки</Header>}>
        <SimpleCell before={<Icon24NotificationOutline />} chevron="always" onClick={onOpenNotifications}>
          Уведомления
        </SimpleCell>
        <SimpleCell before={<Icon24HelpOutline />} chevron="always" onClick={onOpenSupport}>
          Помощь и поддержка
        </SimpleCell>
        <SimpleCell before={<Icon24InfoCircleOutline />} chevron="always" onClick={onOpenAbout}>
          О сервисе
        </SimpleCell>
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};
