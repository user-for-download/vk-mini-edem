// mini-app/src/components/ReviewCard.tsx
import { type FC, useState } from "react";
import { Avatar, Caption, Flex, RichCell, Text } from "@vkontakte/vkui";
import { Icon16StarAlt } from "@vkontakte/icons";
import { resolveAvatar } from "@/helpers/avatar";
import type { Review } from "@/types";

const MAX_PREVIEW_LENGTH = 120;

export interface ReviewCardProps {
  review: Review;
}

/**
 * Отзыв в RichCell: аватар, имя, маршрут и роль, рейтинг.
 * Длинный текст обрезается до 120 символов (line-clamp 3) и
 * разворачивается по клику на текст — без «прыжка» layout.
 */
export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const roleLabel =
    review.targetRole === "driver" ? "о водителе" : "о пассажире";

  const isLong = review.text.length > MAX_PREVIEW_LENGTH;
  const displayText =
    isLong && !isExpanded
      ? review.text.slice(0, MAX_PREVIEW_LENGTH).trimEnd() + "…"
      : review.text;

  const textClassName = [
    "ReviewCard__text",
    isLong && "ReviewCard__text--expandable",
    !isExpanded && "ReviewCard__text--clamped",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <RichCell
      before={<Avatar src={resolveAvatar(review.author.avatar)} size={48} />}
      overTitle={`${review.tripRoute} · ${roleLabel}`}
      after={
        <Flex align="center" gap={4} className="ReviewCard__rating">
          <Icon16StarAlt />
          <Text weight="2">{review.rating}</Text>
        </Flex>
      }
      afterAlign="center"
      subtitle={
        <span
          className={textClassName}
          onClick={(e) => {
            if (isLong) {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }
          }}
        >
          {displayText}
          {isLong && !isExpanded && (
            <Text weight="2" className="ReviewCard__showMore">
              {" "}Показать полностью
            </Text>
          )}
        </span>
      }
      bottom={
        <Caption level="1" className="ReviewCard__date">
          {review.date}
        </Caption>
      }
      multiline
      hasHover={isLong}
      hasActive={isLong}
    >
      {review.author.name}
    </RichCell>
  );
};
