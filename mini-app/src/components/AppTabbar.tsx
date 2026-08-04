// mini-app/src/components/AppTabbar.tsx
import { type FC } from "react";
import { Tabbar, TabbarItem } from "@vkontakte/vkui";
import { Icon28HomeOutline, Icon28ServicesOutline, Icon28UserOutline } from "@vkontakte/icons";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";
import { VIEW_HOME, VIEW_ACTION, VIEW_PROFILE, type ViewId } from "@/consts/views";
import type { Role } from "@/types";

export interface AppTabbarProps {
  activeView: ViewId;
  role: Role;
}

export const AppTabbar: FC<AppTabbarProps> = ({ activeView, role }) => {
  const routeNavigator = useRouteNavigator();

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
