// mini-app/src/views/ProfileView/panels/ReviewsPanel/ReviewsPanel.tsx
import { type FC, useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Group,
  Panel,
  PanelHeaderBack,
  PullToRefresh,
  SegmentedControl,
  Spacing,
} from "@vkontakte/vkui";
import type { Role } from "@/types";
import { ReviewCard } from "@/components/ReviewCard";
import { ReviewCardSkeleton } from "@/components/Skeleton/ReviewCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { AppPanelHeader } from "@/components/AppPanelHeader";
import {
  getReviewsForTab,
  REVIEW_TAB_OPTIONS,
  type ReviewTab,
} from "@/helpers/reviewsTabs";
import {
  useMyReviewsQuery,
  useUserReviewsQuery,
} from "@/queries/useReviewsQuery";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export interface ReviewsPanelProps {
  id: string;
  role: Role;
  onBack: () => void;
  onOpenCreateReview: () => void;
}

// VKUI SegmentedControl принимает mutable-массив options — разовый спред
// константы (список статичен, вычисляется один раз на уровне модуля).
const TAB_OPTIONS = [...REVIEW_TAB_OPTIONS];

/** Подсказки пустых состояний по вкладкам (CTA — только там, где оно имеет смысл). */
function getEmptyState(tab: ReviewTab): { title: string; subtitle: string; cta: boolean } {
  switch (tab) {
    case "mine":
      return {
        title: "Вы пока не оставили отзывов",
        subtitle: "Оставьте отзыв о поездке — это поможет другим выбрать маршрут",
        cta: true,
      };
    case "about":
      return {
        title: "О вас пока нет отзывов",
        subtitle: "После поездок пассажиры и водители смогут оценить вас — отзывы появятся здесь",
        cta: false,
      };
  }
}

/**
 * Панель «Отзывы» профиля — все отзывы в одном месте (вместо разрозненных
 * секций «отзывы о вас»/«мои отзывы» в ProfilePanel).
 *
 * Вкладки (SegmentedControl, паттерн PassengerHistoryPanel):
 * - «Мои» — все мои отзывы (GET /reviews/my, все статусы);
 * - «О вас» — публичные отзывы о пользователе (GET /reviews/user/:me,
 *   только published) по активной роли профиля.
 *
 * Фильтрация — чистая функция getReviewsForTab (helpers/reviewsTabs.ts,
 * unit-тесты без DOM). Оба запроса уже кешируются в ProfilePanel/
 * DriverProfileModal — панель переиспользует кэш без доп. трафика.
 */
export const ReviewsPanel: FC<ReviewsPanelProps> = ({
  id,
  role,
  onBack,
  onOpenCreateReview,
}) => {
  const [tab, setTab] = useState<ReviewTab>("mine");
  const currentUser = useCurrentUser();

  const {
    data: myReviews,
    isLoading: myReviewsLoading,
    isError: myReviewsError,
    error: myReviewsErrorObj,
    isFetching: myReviewsFetching,
    refetch: refetchMyReviews,
  } = useMyReviewsQuery();

  const {
    data: aboutReviews,
    isLoading: aboutReviewsLoading,
    isError: aboutReviewsError,
    error: aboutReviewsErrorObj,
    isFetching: aboutReviewsFetching,
    refetch: refetchAboutReviews,
  } = useUserReviewsQuery(currentUser?.id ?? "");

  const visibleReviews = useMemo(
    () => getReviewsForTab(myReviews ?? [], aboutReviews ?? [], tab, role),
    [myReviews, aboutReviews, tab, role]
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchMyReviews(), refetchAboutReviews()]);
  }, [refetchMyReviews, refetchAboutReviews]);

  const isLoading = myReviewsLoading || aboutReviewsLoading;
  const isError = myReviewsError || aboutReviewsError;
  const error = isError ? (myReviewsError ? myReviewsErrorObj : aboutReviewsErrorObj) : null;
  const isRefreshing = (myReviewsFetching || aboutReviewsFetching) && !isLoading;

  const emptyState = getEmptyState(tab);

  return (
    <Panel id={id}>
      <AppPanelHeader before={<PanelHeaderBack onClick={onBack} aria-label="Назад" />}>
        Отзывы
      </AppPanelHeader>

      <PullToRefresh onRefresh={handleRefresh} isFetching={isRefreshing}>
        <div>
          <Group>
            <Box padding="system">
              <SegmentedControl<ReviewTab>
                value={tab}
                onChange={(value) => setTab(value)}
                options={TAB_OPTIONS}
              />
            </Box>
          </Group>

          <Group>
            {isLoading && (
              <Box padding="system">
                <Flex
                  direction="column"
                  gap={12}
                  aria-busy="true"
                  aria-label="Загрузка отзывов"
                >
                  <ReviewCardSkeleton />
                  <ReviewCardSkeleton />
                </Flex>
              </Box>
            )}

            {isError && (
              <EmptyState
                title="Не удалось загрузить отзывы"
                subtitle={
                  error instanceof Error ? error.message : "Попробуйте обновить список позже"
                }
                action={
                  <Box padding="system">
                    <Button size="m" mode="primary" onClick={() => void handleRefresh()}>
                      Попробовать снова
                    </Button>
                  </Box>
                }
              />
            )}

            {!isLoading && !isError && visibleReviews.length > 0 && (
              <Box padding="system">
                <Flex direction="column" gap={12}>
                  {visibleReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </Flex>
              </Box>
            )}

            {!isLoading && !isError && visibleReviews.length === 0 && (
              <EmptyState
                title={emptyState.title}
                subtitle={emptyState.subtitle}
                action={
                  emptyState.cta ? (
                    <Box padding="system">
                      <Button size="m" mode="primary" onClick={onOpenCreateReview}>
                        Оставить отзыв
                      </Button>
                    </Box>
                  ) : undefined
                }
              />
            )}
          </Group>

          <Spacing size={24} />
        </div>
      </PullToRefresh>
    </Panel>
  );
};
