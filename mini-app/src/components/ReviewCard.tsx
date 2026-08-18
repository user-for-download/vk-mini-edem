import type { FC } from "react";
import {
  Accordion,
  Div,
  Flex,
  Text,
} from "@vkontakte/vkui";
import {
  Icon16StarAlt,
  Icon28AddCircleOutline,
  Icon28RemoveCircleOutline,
} from "@vkontakte/icons";
import type { Review } from "@/types";

/** Отзыв с компактным заголовком и полным текстом в раскрывающемся блоке. */
export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  return (
    <Accordion>
      <Accordion.Summary
        iconPosition="before"
        ExpandIcon={Icon28AddCircleOutline}
        CollapseIcon={Icon28RemoveCircleOutline}
        after={
          <Flex align="center" gap={4}>
            <Icon16StarAlt
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_icon_accent)" }}
            />
            <Text weight="2">{review.rating}</Text>
          </Flex>
        }
        subtitle={`${review.tripRoute} · ${review.date}`}
      >
        {review.author.name}
      </Accordion.Summary>
      <Accordion.Content>
        <Div>
          <Text>{review.text}</Text>
        </Div>
      </Accordion.Content>
    </Accordion>
  );
};

export interface ReviewCardProps {
  review: Review;
}
