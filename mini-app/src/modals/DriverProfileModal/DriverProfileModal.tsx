import { type FC } from "react";
import {
  Avatar,
  Box,
  Button,
  Flex,
  ModalCard,
  Separator,
  Spacing,
  Text,
  ScreenSpinner,
} from "@vkontakte/vkui";
import type { CustomModalProps, OpenModalCardProps } from "@vkontakte/vkui";
import { RatingBadge } from "@/components/RatingBadge";
import { ReviewCard } from "@/components/ReviewCard";
import { useUserQuery } from "@/queries/useUsersQuery";
import { useUserReviewsInfiniteQuery } from "@/queries/useReviewsQuery";
import { resolveAvatar } from "@/helpers/avatar";

export type DriverProfileModalProps = CustomModalProps<OpenModalCardProps, { driverId: string }>;

/**
 * Публичный профиль водителя.
 *
 * Больше не использует mock-fallback.
 * Данные загружаются через:
 * - GET /api/users/:id
 * - GET /api/reviews/user/:userId (cursor-based пагинация)
 */
const REVIEWS_PAGE_SIZE = 5;

export const DriverProfileModal: FC<DriverProfileModalProps> = ({
  modalProps,
  driverId: driverIdProp,
}) => {
  const driverId = driverIdProp || "";

  const {
    data: driver,
    isLoading: isLoadingDriver,
    isError: isDriverError,
  } = useUserQuery(driverId);

  const {
    data: reviewsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserReviewsInfiniteQuery(driver?.id ?? "", REVIEWS_PAGE_SIZE);

  if (!driverId) {
    return null;
  }

  if (isLoadingDriver) {
    return (
      <ModalCard
        {...modalProps}
        title="Профиль водителя"
      >
        <Box
          padding="system"
          paddingBlockStart={0}
          className="DriverProfileModal__centered"
        >
          <ScreenSpinner state="loading" />
        </Box>
      </ModalCard>
    );
  }

  if (isDriverError || !driver) {
    return (
      <ModalCard
        {...modalProps}
        title="Профиль не найден"
        description="Не удалось загрузить данные водителя"
      >
        <Box padding="system" paddingBlockStart={0}>
          <Text className="DriverProfileModal__meta">
            Пользователь недоступен или был удален.
          </Text>
        </Box>
      </ModalCard>
    );
  }

  const allReviews = reviewsData?.pages.flatMap((page) => page.items) ?? [];

  return (
    <ModalCard
      {...modalProps}
      title={driver.name}
      description={driver.isVerified ? "Личность подтверждена" : undefined}
    >
      <Box
        padding="system"
        paddingBlockStart={0}
        className="DriverProfileModal__centered"
      >
        <Avatar
          src={resolveAvatar(driver.avatar)}
          size={72}
          className="DriverProfileModal__avatar"
        />

        <Flex justify="center">
          <RatingBadge value={driver.rating} reviewsCount={driver.reviewsCount} />
        </Flex>

        <Text className="DriverProfileModal__meta">
          {driver.tripsCount} поездок на сервисе
        </Text>

        {driver.car && (
          <>
            <Spacing size={12} />
            <Text weight="2">{driver.car.model} · {driver.car.color}</Text>
          </>
        )}

        {driver.about && (
          <Text className="DriverProfileModal__about">
            {driver.about}
          </Text>
        )}
      </Box>

      {allReviews.length > 0 && (
        <>
          <Spacing size={8} />
          <Separator />

          <div className="DriverProfileModal__reviews">
            {allReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          {hasNextPage && (
            <Box padding="system" style={{ textAlign: "center" }}>
              <Button
                size="s"
                mode="tertiary"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Загрузка..." : "Показать ещё"}
              </Button>
            </Box>
          )}
        </>
      )}
    </ModalCard>
  );
};
