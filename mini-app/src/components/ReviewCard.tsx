// mini-app/src/components/ReviewCard.tsx
import { type FC } from "react";
import { Avatar, Box, Caption, Card, Paragraph, Text } from "@vkontakte/vkui";
import { RatingBadge } from "@/components/RatingBadge";
import type { Review } from "@/types";

export interface ReviewCardProps {
  review: Review;
}

export const ReviewCard: FC<ReviewCardProps> = ({ review }) => {
  return (
    <Card mode="shadow" style={{ marginTop: 8 }}>
      <Box padding="system">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Avatar src={review.author.avatar} size={32} />
          <div style={{ flex: 1 }}>
            <Text weight="2">{review.author.name}</Text>
            <Caption level="1" style={{ color: "var(--vkui--color_text_secondary)" }}>
              {review.date}
            </Caption>
          </div>
          <RatingBadge value={review.rating} size="s" />
        </div>
        <Paragraph style={{ marginTop: 8 }}>«{review.text}»</Paragraph>
      </Box>
    </Card>
  );
};
