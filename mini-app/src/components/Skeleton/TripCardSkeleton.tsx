// mini-app/src/components/Skeleton/TripCardSkeleton.tsx
import { type CSSProperties, type FC } from "react";
import { Box, Card, Flex } from "@vkontakte/vkui";

const skeletonStyle: CSSProperties = {
  background: "var(--vkui--color_skeleton_start)",
  borderRadius: 4,
};

export const TripCardSkeleton: FC = () => {
  return (
    <Card mode="shadow">
      <Box padding="system">
        <Flex justify="space-between" style={{ marginBottom: 12 }}>
          <div style={{ ...skeletonStyle, width: 100, height: 14 }} />
          <div style={{ ...skeletonStyle, width: 60, height: 18 }} />
        </Flex>
        <div
          style={{ ...skeletonStyle, width: "100%", height: 60, marginBottom: 12 }}
        />
        <div style={{ ...skeletonStyle, width: "60%", height: 14 }} />
      </Box>
    </Card>
  );
};
