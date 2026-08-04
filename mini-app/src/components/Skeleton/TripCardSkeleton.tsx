// mini-app/src/components/Skeleton/TripCardSkeleton.tsx
import { type FC } from "react";
import { Box, Card } from "@vkontakte/vkui";

export const TripCardSkeleton: FC = () => {
  const skeletonStyle = {
    backgroundColor: "var(--vkui--color_background_secondary)",
    borderRadius: 8,
  };

  return (
    <Card mode="shadow">
      <Box padding="system">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ ...skeletonStyle, width: 100, height: 14 }} />
          <div style={{ ...skeletonStyle, width: 60, height: 18 }} />
        </div>
        <div style={{ ...skeletonStyle, width: "100%", height: 60, marginBottom: 12 }} />
        <div style={{ ...skeletonStyle, width: "60%", height: 14 }} />
      </Box>
    </Card>
  );
};
