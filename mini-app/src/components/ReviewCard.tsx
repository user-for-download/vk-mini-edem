// mini-app/src/components/ReviewCard.tsx
import { type FC, useState } from "react";
import { Avatar, Caption, RichCell, Text } from "@vkontakte/vkui";
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

  return (
    <RichCell
      before={<Avatar src={resolveAvatar(review.author.avatar)} size={48} />}
      overTitle={`${review.tripRoute} · ${roleLabel}`}
      after={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "var(--carpool_accent)",
          }}
        >
          <Icon16StarAlt />
          <Text weight="2">{review.rating}</Text>
        </div>
      }
      afterAlign="center"
      subtitle={
        <span
          onClick={(e) => {
            if (isLong) {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }
          }}
          style={{
            cursor: isLong ? "pointer" : "default",
            WebkitLineClamp: isExpanded ? undefined : 3,
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {displayText}
          {isLong && !isExpanded && (
            <Text
              weight="2"
              style={{ color: "var(--vkui--color_text_accent)" }}
            >
              {" "}Показать полностью
            </Text>
          )}
        </span>
      }
      bottom={
        <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
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
