// mini-app/src/modals/SelectReviewTripModal/SelectReviewTripModal.tsx
import { type FC } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Header,
  ModalPage,
  ModalPageHeader,
  PanelHeaderButton,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import type { Trip, User } from "@/types";
import type { MyReview } from "@/api/reviews.api";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAvailableReviewTripsQuery, useMyReviewsQuery } from "@/queries/useReviewsQuery";

export type SelectReviewTripModalProps = CustomModalProps<
  OpenModalPageProps,
  {
    onSelectTrip: (trip: Trip, target?: User | null) => void;
    /**
     * Пассажирский контекст preselect: когда пикер поездок открыт из
     * контекста конкретного пассажира (например, из его профиля), выбор
     * поездки пробрасывает этот target дальше — в CreateReviewModal,
     * где пассажир окажется предвыбранным. Без контекста — undefined,
     * поведение прежнее (существующие `(trip) => void` хендлеры совместимы).
     */
    target?: User | null;
  }
>;

/**
 * Множество уже оставленных отзывов, ключ — `tripId:target`.
 *
 * Бэкенд учитывает отзывы по паре `tripId:targetUserId`
 * (backend/src/reviews/index.ts), но GET /reviews/my не отдаёт targetUserId,
 * поэтому идентификатором target-пользователя служит его роль: отзывы возможны
 * только между водителем и пассажирами, и для пассажира единственной целью
 * отзыва в поездке является водитель — ключ `tripId:driver` однозначно
 * определяет target-пользователя.
 */
const buildReviewedTargets = (myReviews: MyReview[]): Set<string> =>
  new Set(
    myReviews
      .filter((review): review is MyReview & { tripId: string } => Boolean(review.tripId))
      .map((review) => `${review.tripId}:${review.targetRole}`)
  );

/**
 * Фильтр поездок по отзывам per target, а не per trip — зеркалит логику
 * GET /reviews/available-trips:
 * - пассажир скрывает поездку, только когда оставлен отзыв о водителе
 *   (единственная цель отзыва);
 * - в поездках водителя цели — пассажиры: их состав и количество недоступны
 *   в ответе со списком поездок, поэтому проверить, что отзывы оставлены
 *   всем пассажирам, на клиенте нельзя. Такие поездки не скрываем: итоговую
 *   фильтрацию выполняет бэкенд (он исключает поездки, где все цели
 *   отмечены отзывами).
 */
const isTripVisibleForReview = (
  trip: Trip,
  reviewedTargets: Set<string>,
  currentUserId: string | null
): boolean => {
  const isOwnTrip = currentUserId !== null && trip.driver.id === currentUserId;

  if (isOwnTrip) {
    return true;
  }

  return !reviewedTargets.has(`${trip.id}:driver`);
};

/**
 * Модалка выбора поездки для отзыва.
 *
 * Показывает доступные поездки из GET /api/reviews/available-trips
 * с дополнительной фильтрацией по уже оставленным отзывам: поездка
 * остаётся в списке, пока по ней есть хотя бы одна цель для отзыва.
 */
export const SelectReviewTripModal: FC<SelectReviewTripModalProps> = ({
  modalProps,
  close,
  onSelectTrip,
  target,
}) => {
  const {
    data: reviewableTrips = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useAvailableReviewTripsQuery();

  const { data: myReviews = [], refetch: refetchMyReviews } = useMyReviewsQuery();

  const currentUser = useCurrentUser();

  const reviewedTargets = buildReviewedTargets(myReviews);

  const visibleTrips = reviewableTrips.filter((trip) =>
    isTripVisibleForReview(trip, reviewedTargets, currentUser?.id ?? null)
  );

  return (
    <ModalPage
      {...modalProps}
      settlingHeight={100}
      header={
        <ModalPageHeader
          after={
            <PanelHeaderButton onClick={close} aria-label="Закрыть">
              <Icon24Cancel />
            </PanelHeaderButton>
          }
        >
          Выберите поездку
        </ModalPageHeader>
      }
    >
      {isLoading && (
        <Box padding="system">
          <Flex direction="column" gap={12}>
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
              {/* Повтор дергает оба запроса: список поездок и уже
                  оставленные отзывы (фильтр видимости), чтобы контент
                  полностью восстановился после успеха. */}
              <Button
                size="m"
                mode="primary"
                onClick={() => {
                  void refetch();
                  void refetchMyReviews();
                }}
              >
                Попробовать снова
              </Button>
            </Box>
          }
        />
      )}

      {!isLoading && !isError && visibleTrips.length === 0 && (
        <EmptyState
          title="Пока нет поездок для отзыва"
          subtitle="Когда вы совершите поездку, она появится здесь"
        />
      )}

      {!isLoading && !isError && visibleTrips.length > 0 && (
        <Group header={<Header size="s">Ваши поездки</Header>}>
          <Box padding="system">
            <Flex direction="column" gap={12}>
              {visibleTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onOpen={(selected) => onSelectTrip(selected, target ?? undefined)}
                  hideSeats
                />
              ))}
            </Flex>
          </Box>
        </Group>
      )}
    </ModalPage>
  );
};
