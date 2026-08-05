// mini-app/src/components/AppTabbar.tsx
import { type FC, useMemo } from "react";
import { Tabbar, TabbarItem, Counter } from "@vkontakte/vkui";
import { Icon28HomeOutline, Icon28ServicesOutline, Icon28UserOutline } from "@vkontakte/icons";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { VIEW_HOME, VIEW_ACTION, VIEW_PROFILE, type ViewId } from "@/consts/views";
import type { Role } from "@/types";
import { useMyTripsQuery } from "@/queries/useTripsQuery";

export interface AppTabbarProps {
  activeView: ViewId;
  role: Role;
}

export const AppTabbar: FC<AppTabbarProps> = ({ activeView, role }) => {
  const routeNavigator = useRouteNavigator();

  const { data: myTrips } = useMyTripsQuery({
    enabled: role === "driver",
  });

  const totalPending = useMemo(() => {
    if (role !== "driver" || !myTrips) return 0;
    return (myTrips as Array<{ pendingRequestsCount?: number }>).reduce(
      (sum, trip) => sum + (trip.pendingRequestsCount ?? 0),
      0
    );
  }, [myTrips, role]);

  return (
    <Tabbar>
      <TabbarItem
        selected={activeView === VIEW_HOME}
        onClick={() => routeNavigator.push("/")}
        aria-label="Главная"
        label="Главная"
      >
        <Icon28HomeOutline />
      </TabbarItem>
      <TabbarItem
        selected={activeView === VIEW_ACTION}
        onClick={() =>
          routeNavigator.push(role === "driver" ? "/trips/my" : "/trips/search")
        }
        aria-label={role === "driver" ? "Поездки" : "Поиск"}
        label={role === "driver" ? "Поездки" : "Поиск"}
        indicator={
          role === "driver" && totalPending > 0 ? (
            <Counter size="s" mode="primary">
              {totalPending}
            </Counter>
          ) : undefined
        }
      >
        <Icon28ServicesOutline />
      </TabbarItem>
      <TabbarItem
        selected={activeView === VIEW_PROFILE}
        onClick={() => routeNavigator.push("/profile")}
        aria-label="Профиль"
        label="Профиль"
      >
        <Icon28UserOutline />
      </TabbarItem>
    </Tabbar>
  );
};
