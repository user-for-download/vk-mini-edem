// mini-app/src/components/ReviewCard.tsx
import { type CSSProperties, type FC, useState } from "react";
import { Avatar, Caption, Flex, RichCell, Text, Tappable } from "@vkontakte/vkui";
import { Icon12ChevronDownSmall, Icon12ChevronUpSmall, Icon16StarAlt } from "@vkontakte/icons";
import { resolveAvatar } from "@/helpers/avatar";
import type { Review } from "@/types";

// Ниже этого порога текст наверняка влезает в одну строку — раскрытие не нужно.
// Выше — текст почти гарантированно обрезается, поэтому по тапу раскрываем полностью.
const MIN_EXPAND_LENGTH = 40;

// Однострочное обрезание текста ellipsis'ом (когда комментарий свёрнут)
const collapsedStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/**
 * Отзыв в RichCell: аватар, имя, маршрут, рейтинг.
 * Короткий текст — одной строкой; длинный — свёрнут в одну строку с многоточием,
 * по тапу раскрывается полный комментарий (без дублирования текста).
 */
export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  const [expanded, setExpanded] = useState(false);
  const isExpandable = review.text.length > MIN_EXPAND_LENGTH;

  const toggle = () => setExpanded((v) => !v);

  const subtitle = isExpandable ? (
    <Tappable
      Component="button"
      onClick={toggle}
      aria-expanded={expanded}
      aria-label={expanded ? "Свернуть отзыв" : "Развернуть отзыв"}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        font: "inherit",
        color: "inherit",
      }}
    >
      <Flex align="center" gap={4}>
        <span
          // eslint-disable-next-line react/forbid-dom-props
          style={expanded ? undefined : collapsedStyle}
        >
          {review.text}
        </span>
        {expanded ? (
          <Icon12ChevronUpSmall
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_icon_secondary)" }}
          />
        ) : (
          <Icon12ChevronDownSmall
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_icon_secondary)" }}
          />
        )}
      </Flex>
    </Tappable>
  ) : (
    review.text
  );

  return (
    <RichCell
      before={<Avatar src={resolveAvatar(review.author.avatar)} size={48} />}
      overTitle={review.tripRoute}
      after={
        <Flex
          align="center"
          gap={4}
          // eslint-disable-next-line react/forbid-dom-props
          style={{ color: "var(--vkui--color_icon_accent)" }}
        >
          <Icon16StarAlt />
          <Text weight="2">{review.rating}</Text>
        </Flex>
      }
      afterAlign="center"
      subtitle={subtitle}
      bottom={
        <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
          {review.date}
        </Caption>
      }
    >
      {review.author.name}
    </RichCell>
  );
};

export interface ReviewCardProps {
  review: Review;
}
