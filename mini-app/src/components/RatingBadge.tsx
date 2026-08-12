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
    <Flex gap={3}>
      <Icon12Star style={{ color: "var(--carpool_accent)" }} />
      <Caption level={size === "s" ? "1" : "2"} weight="2">
        {value.toFixed(1)}
        {typeof reviewsCount === "number" && reviewsCount > 0 && (
          <span
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            {" "}· {reviewsCount}
          </span>
        )}
      </Caption>
    </Flex>
  );
};