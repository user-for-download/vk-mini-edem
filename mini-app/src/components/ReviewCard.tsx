// mini-app/src/components/ReviewCard.tsx
import { type FC } from "react";
import { Avatar, Caption, Flex, RichCell, Text, Tooltip } from "@vkontakte/vkui";
import { Icon16StarAlt } from "@vkontakte/icons";
import { resolveAvatar } from "@/helpers/avatar";
import type { Review } from "@/types";

const MAX_PREVIEW_LENGTH = 120;

/**
 * Отзыв в RichCell: аватар, имя, маршрут и роль, рейтинг.
 * Длинный текст обрезается до 120 символов, а полный текст показывается в Tooltip.
 */
export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  const roleLabel =
    review.targetRole === "driver" ? "о водителе" : "о пассажире";

  const isLong = review.text.length > MAX_PREVIEW_LENGTH;
  const displayText = isLong
    ? review.text.slice(0, MAX_PREVIEW_LENGTH).trimEnd() + "…"
    : review.text;

  const content = (
    <span
      // eslint-disable-next-line react/forbid-dom-props
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: 3,
        overflow: "hidden",
      }}
    >
      {displayText}
    </span>
  );

  return (
    <RichCell
      before={<Avatar src={resolveAvatar(review.author.avatar)} size={48} />}
      overTitle={`${review.tripRoute} · ${roleLabel}`}
      after={
        <Flex
          align="center"
          gap={4}
          // eslint-disable-next-line react/forbid-dom-props
          style={{ color: "var(--carpool_accent)" }}
        >
          <Icon16StarAlt />
          <Text weight="2">{review.rating}</Text>
        </Flex>
      }
      afterAlign="center"
      subtitle={
        isLong ? (
          <Tooltip description={review.text} placement="bottom" arrowPadding={10}>
            {content}
          </Tooltip>
        ) : (
          content
        )
      }
      bottom={
        <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
          {review.date}
        </Caption>
      }
      multiline={false}
    >
      {review.author.name}
    </RichCell>
  );
};

export interface ReviewCardProps {
  review: Review;
}


