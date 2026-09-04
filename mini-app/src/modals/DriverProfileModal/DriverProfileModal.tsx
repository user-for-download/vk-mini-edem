import { type FC } from "react";
import {
  Avatar,
  Box,
  Button,
  Flex,
  ModalCard,
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
import { pluralRu } from "@/helpers/plural";

export type DriverProfileModalProps = CustomModalProps<
  OpenModalCardProps,
  { driverId: string; title?: string }
>;

/**
 * Публичный профиль пользователя (водителя или пассажира).
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
  title = "Профиль водителя",
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
        title={title}
      >
        <Box
          padding="system"
          paddingBlockStart={0}
        >
          <Flex justify="center">
            <ScreenSpinner state="loading" />
          </Flex>
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
          <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
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
      >
        <Flex direction="column" align="center" gap={12}>
          <Avatar
            src={resolveAvatar(driver.avatar)}
            size={72}
          />

          <Flex justify="center">
            <RatingBadge value={driver.rating} reviewsCount={driver.reviewsCount} />
          </Flex>

          <Text style={{ color: "var(--vkui--color_text_secondary)" }}>
            {driver.tripsCount}{" "}
            {pluralRu(driver.tripsCount, "поездка", "поездки", "поездок")} на
            сервисе
          </Text>

          {driver.car && (
            <>
              <Spacing size={12} />
              <Text weight="2">{driver.car.model} · {driver.car.color}</Text>
            </>
          )}

          {driver.about && (
            <Text style={{ textAlign: "center", color: "var(--vkui--color_text_secondary)" }}>
              {driver.about}
            </Text>
          )}
        </Flex>
      </Box>
      <Box>
        {allReviews.length > 0 && (
        <>
          <Spacing size={8} />
              {allReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
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
        )}</Box>


    </ModalCard>
  );
};
