// mini-app/src/components/RouteLine.tsx
import { type FC } from "react";
import { Text, Subhead, classNames } from "@vkontakte/vkui";

export interface RoutePoint {
  city: string;
  address?: string;
}

export interface RouteLineProps {
  from: RoutePoint;
  to: RoutePoint;
  className?: string;
}

export const RouteLine: FC<RouteLineProps> = ({ from, to, className }) => {
  return (
    <div className={classNames("RouteLine", className)}>
      <div className="RouteLine__rail">
        <div className="RouteLine__dot" />
        <div className="RouteLine__line" />
        <div className="RouteLine__dot RouteLine__dot--end" />
      </div>
      <div className="RouteLine__stops">
        <div className="RouteLine__stop">
          <Text weight="2" className="RouteLine__city">{from.city}</Text>
          {from.address && (
            <Subhead className="RouteLine__address" style={{ color: "var(--vkui--color_text_secondary)" }}>
              {from.address}
            </Subhead>
          )}
        </div>
        <div className="RouteLine__stop">
          <Text weight="2" className="RouteLine__city">{to.city}</Text>
          {to.address && (
            <Subhead className="RouteLine__address" style={{ color: "var(--vkui--color_text_secondary)" }}>
              {to.address}
            </Subhead>
          )}
        </div>
      </div>
    </div>
  );
};
