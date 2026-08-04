// mini-app/src/hooks/useSwipeBackSync.ts
import { useEffect } from "react";
import { bridge } from "@/helpers/bridge";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";

/**
 * Синхронизирует свайп-назад VK Mini Apps с роутером приложения.
 */
export function useSwipeBackSync() {
  const routeNavigator = useRouteNavigator();

  useEffect(() => {
    if (!bridge.isWebView?.()) {
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "VKWebAppSwipeBack") {
        routeNavigator.back();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [routeNavigator]);
}
