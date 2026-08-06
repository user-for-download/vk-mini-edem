import { useState, type FC } from "react";
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
import { useUserReviewsQuery } from "@/queries/useReviewsQuery";
import { resolveAvatar } from "@/helpers/avatar";

export type DriverProfileModalProps = CustomModalProps<OpenModalCardProps, { driverId: string }>;

/**
 * Публичный профиль водителя.
 *
 * Больше не использует mock-fallback.
 * Данные загружаются через:
 * - GET /api/users/:id
 * - GET /api/reviews/user/:userId
 */
const REVIEWS_PAGE_SIZE = 5;

export const DriverProfileModal: FC<DriverProfileModalProps> = ({
  modalProps,
  driverId: driverIdProp,
}) => {
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(REVIEWS_PAGE_SIZE);

  const driverId = driverIdProp || "";

  const {
    data: driver,
    isLoading: isLoadingDriver,
    isError: isDriverError,
  } = useUserQuery(driverId);

  const {
    data: reviews,
  } = useUserReviewsQuery(driver?.id ?? "");

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

  const allReviews = reviews ?? [];
  const driverReviews = allReviews.slice(0, visibleReviewsCount);
  const hasMoreReviews = allReviews.length > visibleReviewsCount;

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

      {driverReviews.length > 0 && (
        <>
          <Spacing size={8} />
          <Separator />

          <div className="DriverProfileModal__reviews">
            {driverReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          {hasMoreReviews && (
            <Box padding="system" style={{ textAlign: "center" }}>
              <Button
                size="s"
                mode="tertiary"
                onClick={() => setVisibleReviewsCount((prev) => prev + REVIEWS_PAGE_SIZE)}
              >
                Показать ещё ({allReviews.length - visibleReviewsCount})
              </Button>
            </Box>
          )}
        </>
      )}
    </ModalCard>
  );
};
