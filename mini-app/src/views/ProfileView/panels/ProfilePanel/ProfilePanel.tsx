import type { FC } from "react";
import { Avatar, Button, Caption, Box, Group, Header, InfoRow, Panel, SimpleCell, Spacing, Text, Title } from "@vkontakte/vkui";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import type { Role, Trip } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { ReviewCard } from "@/components/ReviewCard";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { useSnackbarStore } from "@/store/useSnackbarStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserReviewsQuery, useAvailableReviewTripsQuery } from "@/queries/useReviewsQuery";

export interface ProfilePanelProps {
  id: string;
  role: Role;
  onChangeRole: (role: Role) => void;
  onOpenCreateReview: () => void;
  onOpenReviewForTrip?: (trip: Trip) => void;
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
  onOpenCreateReview,
  onOpenReviewForTrip,
  onOpenMyBookings,
  onOpenHistory,
  onOpenNotifications,
  onOpenSupport,
  onOpenAbout,
}) => {
  const enqueueSnackbar = useSnackbarStore((state) => state.enqueue);
  const currentUser = useCurrentUser();
  const routeNavigator = useRouteNavigator();

  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useUserReviewsQuery(currentUser.id);

  const {
    data: availableReviewTrips,
    isLoading: availableReviewTripsLoading,
    isError: availableReviewTripsError,
  } = useAvailableReviewTripsQuery();

  const visibleReviews = (reviewsData ?? []).slice(0, 2);

  return (
    <Panel id={id}>
      <AppPanelHeader>Профиль</AppPanelHeader>
      <Group>
        <Box padding="system" style={{ textAlign: "center" }}>
          <Avatar src={currentUser.avatar} size={80} style={{ margin: "0 auto 12px" }} />
          <Title level="2" weight="2">
            {currentUser.name}
          </Title>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
            <RatingBadge value={currentUser.rating} reviewsCount={currentUser.reviewsCount} />
          </div>
          {currentUser.isVerified && (
            <Caption level="1" style={{ color: "var(--carpool_accent)", marginTop: 4 }}>
              Личность подтверждена ВКонтакте
            </Caption>
          )}
          <Spacing size={16} />
          <Button
            mode="secondary"
            size="m"
            onClick={() => {
              enqueueSnackbar({
                type: "success",
                title: "Профиль обновлен",
                subtitle: "Изменения успешно сохранены",
                dedupeKey: "profile_update",
              });
            }}
          >
            Редактировать
          </Button>
        </Box>

        <Box padding="system" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <InfoRow header="Поездок совершено">{currentUser.tripsCount}</InfoRow>
          <InfoRow header="На сервисе с">2024</InfoRow>
        </Box>

        <Box padding="system">
          <RoleSwitcher role={role} onChange={onChangeRole} />
        </Box>
      </Group>

      {role === "driver" && currentUser.car && (
        <Group header={<Header size="s">Автомобиль</Header>}>
          <Box padding="system" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoRow header="Модель">{currentUser.car.model}</InfoRow>
            <InfoRow header="Цвет">{currentUser.car.color}</InfoRow>
            <InfoRow header="Номер">{currentUser.car.plate}</InfoRow>
          </Box>
        </Group>
      )}

      <Group header={<Header size="s">Поездки для отзыва</Header>}>
        {availableReviewTripsLoading && (
          <SimpleCell subtitle="Ищем завершенные поездки">
            Загрузка...
          </SimpleCell>
        )}

        {availableReviewTripsError && (
          <SimpleCell subtitle="Не удалось загрузить список поездок">
            Ошибка загрузки
          </SimpleCell>
        )}

        {!availableReviewTripsLoading &&
          !availableReviewTripsError &&
          (availableReviewTrips ?? []).length === 0 && (
            <SimpleCell subtitle="Когда вы совершите поездку, она появится здесь">
              Нет доступных поездок для отзыва
            </SimpleCell>
          )}

        {!availableReviewTripsLoading &&
          !availableReviewTripsError &&
          (availableReviewTrips ?? []).map((trip) => (
            <SimpleCell
              key={trip.id}
              chevron="always"
              onClick={() => onOpenReviewForTrip?.(trip)}
              subtitle={`${trip.date} · ${trip.time}`}
            >
              {trip.fromCity} → {trip.toCity}
            </SimpleCell>
          ))}
      </Group>

      <Group header={<Header size="s">Поездки и брони</Header>}>
        <SimpleCell
          chevron="always"
          onClick={() => (onOpenMyBookings ? onOpenMyBookings() : routeNavigator.push("/bookings"))}
          subtitle="Просмотр активных броней и управления ими"
        >
          Мои брони
        </SimpleCell>
        <SimpleCell
          chevron="always"
          onClick={() => (onOpenHistory ? onOpenHistory() : routeNavigator.push("/bookings/history"))}
          subtitle="Просмотр завершенных и отмененных поездок"
        >
          История поездок
        </SimpleCell>
        <SimpleCell
          chevron="always"
          onClick={onOpenCreateReview}
          subtitle="Выберите поездку, в которой вы участвовали, и оставьте отзыв"
        >
          Оставить отзыв
        </SimpleCell>
      </Group>

      <Group header={<Header size="s">Отзывы о вас</Header>}>
        {reviewsLoading && (
          <Box padding="system">
            <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
              Загрузка отзывов...
            </Text>
          </Box>
        )}

        {reviewsError && (
          <Box padding="system">
            <Text style={{ color: "var(--vkui--color_text_negative)" }}>
              Не удалось загрузить отзывы
            </Text>
          </Box>
        )}

        {!reviewsLoading && !reviewsError && visibleReviews.length > 0 && (
          <>
            {visibleReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </>
        )}

        {!reviewsLoading && !reviewsError && visibleReviews.length === 0 && (
          <Box padding="system">
            <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
              Отзывов пока нет
            </Text>
          </Box>
        )}
      </Group>

      <Group header={<Header size="s">Настройки</Header>}>
        <SimpleCell chevron="always" onClick={onOpenNotifications}>
          Уведомления
        </SimpleCell>
        <SimpleCell chevron="always" onClick={onOpenSupport}>
          Помощь и поддержка
        </SimpleCell>
        <SimpleCell chevron="always" onClick={onOpenAbout}>
          О сервисе
        </SimpleCell>
      </Group>

      <Spacing size={24} />
    </Panel>
  );
};
