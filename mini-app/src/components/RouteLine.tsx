// mini-app/src/components/RouteLine.tsx
import { type FC } from "react";
import { Text, Subhead } from "@vkontakte/vkui";

export interface RoutePoint {
  city: string;
  address?: string;
}

export interface RouteLineProps {
  from: RoutePoint;
  to: RoutePoint;
}

export const RouteLine: FC<RouteLineProps> = ({ from, to }) => {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--carpool_accent)" }} />
        <div style={{ width: 2, flex: 1, minHeight: 20, background: "var(--vkui--color_separator_primary)" }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--vkui--color_text_negative)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <Text weight="2">{from.city}</Text>
        {from.address && (
          <Subhead style={{ color: "var(--vkui--color_text_secondary)" }}>
            {from.address}
          </Subhead>
        )}
        <div style={{ height: 8 }} />
        <Text weight="2">{to.city}</Text>
        {to.address && (
          <Subhead style={{ color: "var(--vkui--color_text_secondary)" }}>
            {to.address}
          </Subhead>
        )}
      </div>
    </div>
  );
};
