// mini-app/src/components/RouteLine.tsx
import { type FC } from "react";
import { Text, Subhead, Flex } from "@vkontakte/vkui";

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
    <Flex gap={12}>
      <div
        // eslint-disable-next-line react/forbid-dom-props
        style={{
          flexDirection: "column",
          alignItems: "center",
          width: 10,
        }}
      >
        <div
          // eslint-disable-next-line react/forbid-dom-props
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--carpool_accent)",
          }}
        />
        <div
          // eslint-disable-next-line react/forbid-dom-props
          style={{
            flex: 1,
            width: 2,
            minHeight: 22,
            opacity: 0.55,
            background: "repeating-linear-gradient(to bottom, var(--carpool_accent) 0, var(--carpool_accent) 3px, transparent 3px, transparent 7px)",
          }}
        />
        <div
          // eslint-disable-next-line react/forbid-dom-props
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--vkui--color_icon_secondary, #99a2ad)",
          }}
        />
      </div>
      <div
        // eslint-disable-next-line react/forbid-dom-props
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div // eslint-disable-next-line react/forbid-dom-props
        style={{ minWidth: 0 }}>
          <Text weight="2" // eslint-disable-next-line react/forbid-dom-props
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {from.city}
          </Text>
          {from.address && (
            <Subhead
              // eslint-disable-next-line react/forbid-dom-props
              style={{
                color: "var(--vkui--color_text_secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {from.address}
            </Subhead>
          )}
        </div>
        <div // eslint-disable-next-line react/forbid-dom-props
        style={{ minWidth: 0 }}>
          <Text weight="2" // eslint-disable-next-line react/forbid-dom-props
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {to.city}
          </Text>
          {to.address && (
            <Subhead
              // eslint-disable-next-line react/forbid-dom-props
              style={{
                color: "var(--vkui--color_text_secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {to.address}
            </Subhead>
          )}
        </div>
      </div>
    </Flex>
  );
};