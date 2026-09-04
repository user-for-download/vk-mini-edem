import type { FC, ReactNode } from "react";
import { Avatar, ContentBadge, Flex, Footnote, SimpleCell } from "@vkontakte/vkui";
import { Icon24Favorite } from "@vkontakte/icons";
import { REVIEW_STATUS, type ReviewStatusValue } from "@edem/contracts";
import { resolveAvatar } from "@/helpers/avatar";
import type { Review } from "@/types";

/** Бейдж статуса — только для непубличных отзывов. Null для "published" (бейджа нет). */
function getStatusBadge(status: ReviewStatusValue): ReactNode {
  switch (status) {
    case REVIEW_STATUS.PENDING:
      return (
        <ContentBadge mode="outline" appearance="neutral">
          На модерации
        </ContentBadge>
      );
    case REVIEW_STATUS.REJECTED:
      return (
        <ContentBadge mode="secondary" appearance="accent-red">
          Отклонён
        </ContentBadge>
      );
    default:
      return null;
  }
}

/**
 * Отзыв на шаблоне SimpleCell (некликабельная статическая ячейка).
 *
 * - `children` — имя автора + бейдж статуса (только для непубличных).
 * - `before` — Avatar 44 автора (resolveAvatar с плейсхолдером).
 * - `multiline` — полный текст до 150 символов без ellipsis.
 * - `extraSubtitle` — «ОТКУДА-КУДА · дата».
 * - `subtitle` — текст комментария.
 * - `indicator` — оценка + сердечко (число слева, иконка справа).
 */
export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  return (
    <SimpleCell
      multiline
      before={<Avatar size={44} src={resolveAvatar(review.author.avatar)} />}
      extraSubtitle={`${review.tripRoute} · ${review.date}`}
      subtitle={review.text}
      indicator={
        <Flex align="center" gap="2xs">
          <Footnote
            weight="2"
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_text_primary)" }}
          >
            {review.rating}
          </Footnote>
          <Icon24Favorite style={{ color: "var(--vkui--color_icon_accent_themed)" }} />
        </Flex>
      }
    >
      <Flex align="center" gap={6}>
        {review.author.name}
        {getStatusBadge(review.status)}
      </Flex>
    </SimpleCell>
  );
};

export interface ReviewCardProps {
  review: Review;
}
