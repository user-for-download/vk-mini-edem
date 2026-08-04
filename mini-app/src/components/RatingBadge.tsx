// mini-app/src/components/RatingBadge.tsx
import { type FC } from "react";
import { Caption } from "@vkontakte/vkui";
import { Icon12Star } from "@vkontakte/icons";

export interface RatingBadgeProps {
  value: number;
  reviewsCount?: number;
  size?: "s" | "m";
}

export const RatingBadge: FC<RatingBadgeProps> = ({ value, reviewsCount, size = "m" }) => {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Icon12Star fill="var(--carpool_accent)" />
      <Caption level={size === "s" ? "1" : "2"} weight="2">
        {value.toFixed(1)}
        {typeof reviewsCount === "number" && reviewsCount > 0 && (
          <span style={{ color: "var(--vkui--color_text_secondary)", marginLeft: 4 }}>
            · {reviewsCount}
          </span>
        )}
      </Caption>
    </div>
  );
};
