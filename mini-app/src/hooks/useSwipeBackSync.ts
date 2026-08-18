// mini-app/src/hooks/useSwipeBackSync.ts
import { useEffect } from "react";
import { bridge } from "@/helpers/bridge";
import { useActiveVkuiLocation, useRouteNavigator } from "@vkontakte/vk-mini-apps-router";

/**
 * Синхронизирует свайп-назад VK Mini Apps с роутером приложения.
 */
export function useSwipeBackSync() {
  const routeNavigator = useRouteNavigator();
  const { panel } = useActiveVkuiLocation();

  useEffect(() => {
    if (!bridge.isWebView?.()) {
      return;
    }

    const handler = (event: MessageEvent) => {
      if (
        event.source === window.parent &&
        (event.origin === "https://vk.com" ||
          event.origin === "https://m.vk.com" ||
          event.origin === "https://vk.ru" ||
          event.origin === "https://m.vk.ru") &&
        event.data?.type === "VKWebAppSwipeBack"
      ) {
        routeNavigator.back();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [routeNavigator]);

  useEffect(() => {
    if (!bridge.isWebView?.()) return;
    void bridge.send("VKWebAppSetSwipeSettings", {
      history: !panel || panel === "panel-home",
    }).catch(() => {
      // Standalone browsers and older VK clients may not support this method.
    });
  }, [panel]);
}
