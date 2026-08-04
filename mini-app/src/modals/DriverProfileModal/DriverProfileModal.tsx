import { useState, type FC } from "react";
import {
  Avatar,
  Box,
  Button,
  ModalCard,
  ModalCardProps,
  Separator,
  Spacing,
  Text,
  ScreenSpinner,
} from "@vkontakte/vkui";
import { useSearchParams } from "@vkontakte/vk-mini-apps-router";
import { RatingBadge } from "@/components/RatingBadge";
import { ReviewCard } from "@/components/ReviewCard";
import { useUserQuery } from "@/queries/useUsersQuery";
import { useUserReviewsQuery } from "@/queries/useReviewsQuery";

export interface DriverProfileModalProps extends ModalCardProps {
  id: string;

  /**
   * Id водителя.
   *
   * Если не передан явно, берем из search params: driverId.
   */
  driverId?: string | null;

  onClose: () => void;
}

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
  id,
  driverId: driverIdProp,
  onClose,
  ...restProps
}) => {
  const [searchParams] = useSearchParams();
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(REVIEWS_PAGE_SIZE);

  const driverId = driverIdProp || searchParams.get("driverId") || "";

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
        id={id}
        onClose={onClose}
        title="Профиль водителя"
        {...restProps}
      >
        <Box padding="system" style={{ paddingTop: 0, textAlign: "center" }}>
          <ScreenSpinner state="loading" />
        </Box>
      </ModalCard>
    );
  }

  if (isDriverError || !driver) {
    return (
      <ModalCard
        id={id}
        onClose={onClose}
        title="Профиль не найден"
        description="Не удалось загрузить данные водителя"
        {...restProps}
      >
        <Box padding="system" style={{ paddingTop: 0 }}>
          <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
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
      id={id}
      onClose={onClose}
      title={driver.name}
      description={driver.isVerified ? "Личность подтверждена" : undefined}
      {...restProps}
    >
      <Box padding="system" style={{ paddingTop: 0, textAlign: "center" }}>
        <Avatar src={driver.avatar} size={72} style={{ margin: "0 auto 12px" }} />

        <div style={{ display: "flex", justifyContent: "center" }}>
          <RatingBadge value={driver.rating} reviewsCount={driver.reviewsCount} />
        </div>

        <Text
          style={{
            color: "var(--vkui--color_text_secondary)",
            marginTop: 4,
          }}
        >
          {driver.tripsCount} поездок на сервисе
        </Text>

        {driver.car && (
          <Text weight="2" style={{ marginTop: 12 }}>
            {driver.car.model} · {driver.car.color}
          </Text>
        )}

        {driver.about && (
          <Text
            style={{
              marginTop: 8,
              color: "var(--vkui--color_text_secondary)",
            }}
          >
            {driver.about}
          </Text>
        )}
      </Box>

      {driverReviews.length > 0 && (
        <>
          <Spacing size={8} />
          <Separator />

          <div style={{ textAlign: "left" }}>
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
