// mini-app/src/modals/DriverProfileModal/DriverProfileModal.tsx
import type { FC } from "react";
import {
  Avatar,
  Box,
  ModalCard,
  ModalCardProps,
  Separator,
  Spacing,
  Text,
} from "@vkontakte/vkui";
import { useSearchParams } from "@vkontakte/vk-mini-apps-router";
import type { User } from "@/types";
import { RatingBadge } from "@/components/RatingBadge";
import { ReviewCard } from "@/components/ReviewCard";
import { useUserQuery } from "@/queries/useUsersQuery";
import { useUserReviewsQuery } from "@/queries/useReviewsQuery";

export interface DriverProfileModalProps extends ModalCardProps {
  id: string;
  driver: User | null;
  onClose: () => void;
}

/**
 * Публичный профиль водителя: рейтинг, машина, «о себе» и последние отзывы.
 * Теперь данные берутся из API:
 * - GET /api/users/:id
 * - GET /api/reviews/user/:userId
 */
export const DriverProfileModal: FC<DriverProfileModalProps> = ({
  id,
  driver,
  onClose,
  ...restProps
}) => {
  const [searchParams] = useSearchParams();

  const driverId = driver?.id || searchParams.get("driverId") || "";

  const { data: fetchedDriver, isLoading: isDriverLoading } =
    useUserQuery(driverId);

  const resolvedDriver = fetchedDriver ?? driver;

  const {
    data: reviewsData,
    isLoading: isReviewsLoading,
    isError: isReviewsError,
  } = useUserReviewsQuery(resolvedDriver?.id ?? driverId);

  if (!resolvedDriver && isDriverLoading) {
    return null;
  }

  if (!resolvedDriver) {
    return null;
  }

  const driverReviews = (reviewsData ?? []).slice(0, 2);

  return (
    <ModalCard
      id={id}
      onClose={onClose}
      title={resolvedDriver.name}
      description={
        resolvedDriver.isVerified ? "Личность подтверждена" : undefined
      }
      {...restProps}
    >
      <Box padding="system" style={{ paddingTop: 0, textAlign: "center" }}>
        <Avatar
          src={resolvedDriver.avatar}
          size={72}
          style={{ margin: "0 auto 12px" }}
        />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <RatingBadge
            value={resolvedDriver.rating}
            reviewsCount={resolvedDriver.reviewsCount}
          />
        </div>

        <Text
          style={{
            color: "var(--vkui--color_text_secondary)",
            marginTop: 4,
          }}
        >
          {resolvedDriver.tripsCount} поездок на сервисе
        </Text>

        {resolvedDriver.car && (
          <Text weight="2" style={{ marginTop: 12 }}>
            {resolvedDriver.car.model} · {resolvedDriver.car.color}
          </Text>
        )}

        {resolvedDriver.about && (
          <Text
            style={{
              marginTop: 8,
              color: "var(--vkui--color_text_secondary)",
            }}
          >
            {resolvedDriver.about}
          </Text>
        )}
      </Box>

      <Spacing size={8} />
      <Separator />

      {isReviewsLoading && (
        <Box padding="system">
          <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
            Загрузка отзывов...
          </Text>
        </Box>
      )}

      {isReviewsError && (
        <Box padding="system">
          <Text style={{ color: "var(--vkui--color_text_negative)" }}>
            Не удалось загрузить отзывы
          </Text>
        </Box>
      )}

      {!isReviewsLoading && !isReviewsError && driverReviews.length > 0 && (
        <div style={{ textAlign: "left" }}>
          {driverReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {!isReviewsLoading && !isReviewsError && driverReviews.length === 0 && (
        <Box padding="system">
          <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
            Отзывов пока нет
          </Text>
        </Box>
      )}
    </ModalCard>
  );
};
