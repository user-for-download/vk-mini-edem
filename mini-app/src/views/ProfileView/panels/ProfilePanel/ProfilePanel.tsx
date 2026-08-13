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
import { ReviewCard } from "@/components/ReviewCard";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import { resolveAvatar } from "@/helpers/avatar";
import { useSnackbar } from "@/providers/SnackbarProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserReviewsQuery, useAvailableReviewTripsQuery } from "@/queries/useReviewsQuery";
import { usersApi } from "@/api/users.api";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";

export interface ProfilePanelProps {
  id: string;
  role: Role;
  onChangeRole: (role: Role) => void;
  onOpenCreateReview: () => void;
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
  onOpenCreateReview,
  onOpenReviewForTrip,
  onOpenCarForm,
  onOpenEditProfile,
  onOpenMyBookings,
  onOpenHistory,
  onOpenNotifications,
  onOpenSupport,
  onOpenAbout,
}) => {
  const { enqueue: enqueueSnackbar } = useSnackbar();
  const currentUser = useCurrentUser();
  const routeNavigator = useRouteNavigator();

  const verifyMutation = useMutation({
    mutationFn: () => usersApi.requestVerification(),
    onSuccess: (data) => {
      useAuthStore.setState({ user: data });
      enqueueSnackbar({ type: "success", title: "Заявка отправлена", subtitle: "Рассмотрение займет до 24 часов", dedupeKey: "verify_ok" });
    },
    onError: () => enqueueSnackbar({ type: "error", title: "Ошибка", dedupeKey: "verify_error" })
  });

  const {
    data: reviewsData,
    isLoading: reviewsLoading,
    isError: reviewsError,
  } = useUserReviewsQuery(currentUser?.id ?? "");

  const {
    data: availableReviewTrips,
    isLoading: availableReviewTripsLoading,
    isError: availableReviewTripsError,
  } = useAvailableReviewTripsQuery();

  if (!currentUser) {
    return (
      <Panel id={id}>
        <AppPanelHeader>Профиль</AppPanelHeader>
        <Box padding="system"><Text>Загрузка профиля...</Text></Box>
      </Panel>
    );
  }

  const visibleReviews = (reviewsData ?? []).slice(0, 2);

  return (
    <Panel id={id}>
      <AppPanelHeader>Профиль</AppPanelHeader>
      <Group>
        <Box padding="system" className="ProfilePanel__profileHeader">
          <Avatar src={resolveAvatar(currentUser.avatar)} size={80} className="ProfilePanel__avatar" />
          <Title level="2" weight="2">
            {currentUser.name}
          </Title>
          <Flex justify="center" className="ProfilePanel__rating">
            <RatingBadge value={currentUser.rating} reviewsCount={currentUser.reviewsCount} />
          </Flex>
          {currentUser.isVerified ? (
            <Caption level="1" className="ProfilePanel__statusText ProfilePanel__statusText--verified">
              Личность подтверждена ВКонтакте
            </Caption>
          ) : currentUser.verificationStatus === "pending" ? (
            <Caption level="1" className="ProfilePanel__statusText ProfilePanel__statusText--pending">
              Заявка на верификацию на рассмотрении
            </Caption>
          ) : (
            <Button
              size="s"
              mode="outline"
              onClick={() => verifyMutation.mutate()}
              loading={verifyMutation.isPending}
              className="ProfilePanel__verifyButton"
            >
              Пройти верификацию
            </Button>
          )}
          <Spacing size={16} />
          <Button mode="secondary" size="m" onClick={onOpenEditProfile}>
            Редактировать
          </Button>
        </Box>

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
        <Group header={<Header size="s">Автомобиль</Header>}>
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

      <Group header={<Header size="s">Поездки для отзыва</Header>}>
        {availableReviewTripsLoading && (
          <SimpleCell before={<Icon24StarsOutline />} subtitle="Ищем завершенные поездки">
            Загрузка...
          </SimpleCell>
        )}

        {availableReviewTripsError && (
          <SimpleCell before={<Icon24StarsOutline />} subtitle="Не удалось загрузить список поездок">
            Ошибка загрузки
          </SimpleCell>
        )}

        {!availableReviewTripsLoading &&
          !availableReviewTripsError &&
          (availableReviewTrips ?? []).length === 0 && (
            <SimpleCell before={<Icon24StarsOutline />} subtitle="Когда вы совершите поездку, она появится здесь">
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

      <Group header={<Header size="s">Поездки и брони</Header>}>
        {role === "driver" && (
          <SimpleCell
            before={<Icon24CarOutline />}
            chevron="always"
            onClick={() => routeNavigator.push("/trips/my")}
            subtitle="Ваши опубликованные маршруты (активные и архив)"
          >
            Мои поездки (водитель)
          </SimpleCell>
        )}
        <SimpleCell
          before={<Icon24DocumentOutline />}
          chevron="always"
          onClick={() => (onOpenMyBookings ? onOpenMyBookings() : routeNavigator.push("/bookings"))}
          subtitle="Поездки, на которые вы забронировали место"
        >
          Мои брони (пассажир)
        </SimpleCell>
        <SimpleCell
          before={<Icon24ServicesOutline />}
          chevron="always"
          onClick={() => (onOpenHistory ? onOpenHistory() : routeNavigator.push("/bookings/history"))}
          subtitle="Завершенные и отмененные брони"
        >
          История поездок (пассажир)
        </SimpleCell>
        <SimpleCell
          before={<Icon24MessageStarsOutline />}
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
            <Text className="ProfilePanel__text--secondary">
              Загрузка отзывов...
            </Text>
          </Box>
        )}

        {reviewsError && (
          <Box padding="system">
            <Text className="ProfilePanel__text--negative">
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
            <Text className="ProfilePanel__text--secondary">
              Отзывов пока нет
            </Text>
          </Box>
        )}
      </Group>

      <Group header={<Header size="s">Настройки</Header>}>
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
