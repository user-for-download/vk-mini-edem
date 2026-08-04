// mini-app/src/hooks/useSwipeBackSync.ts
import { useEffect } from "react";
import vkBridge from "@vkontakte/vk-bridge";
import { useRouteNavigator } from "@vkontakte/vk-mini-apps-router";

/**
 * Синхронизирует свайп-назад VK Mini Apps с роутером приложения.
 */
export function useSwipeBackSync() {
  const routeNavigator = useRouteNavigator();

  useEffect(() => {
    if (!vkBridge.isWebView?.()) {
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
