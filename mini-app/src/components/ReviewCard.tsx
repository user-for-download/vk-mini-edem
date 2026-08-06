// mini-app/src/components/ReviewCard.tsx
import { type FC } from "react";
import { RichCell, Avatar, Text } from "@vkontakte/vkui";
import { Icon16StarAlt } from "@vkontakte/icons";
import { resolveAvatar } from "@/helpers/avatar";
import type { Review } from "@/types";

export interface ReviewCardProps {
  review: Review;
  onClick?: () => void; // если нужно раскрывать полный текст
}

/**
 * Отзыв в виде RichCell: единообразные отступы и типографика VKUI.
 * before — аватар, overTitle — маршрут, children — имя автора,
 * subtitle — дата + о ком, after — рейтинг, bottom — текст отзыва.
 */
export const ReviewCard: FC<ReviewCardProps> = ({ review, onClick }) => {
  const roleLabel =
    review.targetRole === "driver" ? "о водителе" : "о пассажире";

  return (
    <RichCell
      before={<Avatar src={resolveAvatar(review.author.avatar)} size={48} />}
      overTitle={review.tripRoute}
      subtitle={`${review.date} · ${roleLabel}`}
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
      bottom={
        <Text
          style={{
            marginTop: 4,
            color: "var(--vkui--color_text_primary)",
          }}
        >
          {review.text}
        </Text>
      }
      multiline
      hasHover={Boolean(onClick)}
      hasActive={Boolean(onClick)}
      onClick={onClick}
    >
      {review.author.name}
    </RichCell>
  );
};
