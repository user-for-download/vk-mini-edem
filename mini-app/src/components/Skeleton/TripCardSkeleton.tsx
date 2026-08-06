// mini-app/src/components/Skeleton/TripCardSkeleton.tsx
import { type FC } from "react";
import { Box, Card, Flex, Spacing } from "@vkontakte/vkui";

export const TripCardSkeleton: FC = () => {
  return (
    <Card mode="shadow">
      <Box padding="system">
        <Flex justify="space-between">
          <div className="TripCardSkeleton__line TripCardSkeleton__line--title-left" />
          <div className="TripCardSkeleton__line TripCardSkeleton__line--title-right" />
        </Flex>
        <Spacing size={12} />
        <div className="TripCardSkeleton__line TripCardSkeleton__line--map" />
        <Spacing size={12} />
        <div className="TripCardSkeleton__line TripCardSkeleton__line--duration" />
      </Box>
    </Card>
  );
};
