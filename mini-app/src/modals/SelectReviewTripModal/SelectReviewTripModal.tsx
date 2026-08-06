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
  Text,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalPageProps } from "@vkontakte/vkui";
import { Icon24Cancel } from "@vkontakte/icons";
import type { Trip } from "@/types";
import { TripCard } from "@/components/TripCard";
import { TripCardSkeleton } from "@/components/Skeleton/TripCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { useAvailableReviewTripsQuery, useMyReviewsQuery } from "@/queries/useReviewsQuery";

export interface SelectReviewTripModalProps
  extends CustomModalProps<OpenModalPageProps, { onSelectTrip: (trip: Trip) => void }> {}

/**
 * Модалка выбора поездки для отзыва.
 *
 * Показывает доступные поездки из GET /api/reviews/available-trips
 * с дополнительной фильтрацией по уже оставленным отзывам.
 */
export const SelectReviewTripModal: FC<SelectReviewTripModalProps> = ({
  modalProps,
  close,
  onSelectTrip,
}) => {
  const {
    data: reviewableTrips = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useAvailableReviewTripsQuery();

  const { data: myReviews = [] } = useMyReviewsQuery();

  const reviewedTripIds = new Set(
    myReviews
      .map((review) => review.tripId)
      .filter((tripId): tripId is string => Boolean(tripId))
  );

  const visibleTrips = reviewableTrips.filter(
    (trip) => !reviewedTripIds.has(trip.id)
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
              <Button size="m" mode="primary" onClick={() => refetch()}>
                Попробовать снова
              </Button>
            </Box>
          }
        />
      )}

      {!isLoading && !isError && visibleTrips.length === 0 && (
        <EmptyState
          title="Пока нет поездок для отзыва"
          subtitle="Когда вы совершите поездку как пассажир, она появится здесь"
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
                  onOpen={onSelectTrip}
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
