// mini-app/src/components/RatingBadge.tsx
import { type FC } from "react";
import { Caption, Flex } from "@vkontakte/vkui";
import { Icon12Star } from "@vkontakte/icons";

export interface RatingBadgeProps {
  value: number;
  reviewsCount?: number;
  size?: "s" | "m";
}

export const RatingBadge: FC<RatingBadgeProps> = ({ value, reviewsCount, size = "m" }) => {
  return (
    <Flex className="RatingBadge" gap={3}>
      <Icon12Star className="RatingBadge__star" />
      <Caption level={size === "s" ? "1" : "2"} weight="2">
        {value.toFixed(1)}
        {typeof reviewsCount === "number" && reviewsCount > 0 && (
          <span className="RatingBadge__count">
            · {reviewsCount}
          </span>
        )}
      </Caption>
    </Flex>
  );
};
