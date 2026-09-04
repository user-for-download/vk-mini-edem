// mini-app/src/components/Skeleton/ReviewCardSkeleton.tsx
import { type FC } from "react";
import { Box, Flex, Skeleton } from "@vkontakte/vkui";

/**
 * Скелетон карточки отзыва (аналог TripCardSkeleton для списков отзывов).
 * Форма повторяет новый ReviewCard на SimpleCell: Avatar 28 слева,
 * три текстовые строки (имя / комментарий / «маршрут · дата»),
 * индикатор «сердечко + оценка» справа.
 */
export const ReviewCardSkeleton: FC = () => (
  <Box padding="system">
    <Flex align="center" gap={12}>
      <Skeleton width={28} height={28} borderRadius="50%" />
      <Flex direction="column" gap={8} style={{ flex: 1 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="60%" height={12} />
      </Flex>
      <Skeleton width={36} height={14} />
    </Flex>
  </Box>
);
