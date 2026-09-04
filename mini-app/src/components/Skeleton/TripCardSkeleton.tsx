// mini-app/src/components/Skeleton/TripCardSkeleton.tsx
import { type FC } from "react";
import { Skeleton, Card, Box, Flex, Spacing } from "@vkontakte/vkui";

export const TripCardSkeleton: FC = () => (
  <Card mode="shadow">
    <Box padding="system">
      <Flex justify="space-between">
        <Skeleton width={100} height={14} />
        <Skeleton width={60} height={18} />
      </Flex>
      <Spacing size={12} />
      <Skeleton width="100%" height={60} />
      <Spacing size={12} />
      <Skeleton width="60%" height={14} />
    </Box>
  </Card>
);