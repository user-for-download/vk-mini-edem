import type { FC, PropsWithChildren } from "react";
import { AdaptivityProvider, AppRoot, ConfigProvider } from "@vkontakte/vkui";
import { RouterProvider } from "@vkontakte/vk-mini-apps-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { parseURLSearchParamsForGetLaunchParams } from "@vkontakte/vk-bridge";
import { useAppearance, useInsets, useAdaptivity } from "@vkontakte/vk-bridge-react";
import { bridge } from "@/helpers/bridge";

import { transformVKBridgeAdaptivity } from "@/helpers/transformVKBridgeAdaptivity";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthGate } from "@/components/AuthGate";
import { router } from "@/router";
import { WsProvider } from "@/providers/WsProvider";
import { GlobalWsListener } from "@/components/GlobalWsListener";
import { ModalProvider } from "@/providers/ModalProvider";
import { SnackbarProvider } from "@/providers/SnackbarProvider";

import { ApiError } from "@/api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status && error.status >= 400 && error.status < 500) {
          return false;
        }
        if (error instanceof Error && error.message.startsWith("HTTP error 4")) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const AppConfig: FC<PropsWithChildren> = ({ children }) => {
  const vkBridgeColorScheme = useAppearance() || "light";
  const vkBridgeInsets = useInsets() || undefined;
  const vkBridgeAdaptivityProps = transformVKBridgeAdaptivity(useAdaptivity());

  const { vk_platform } = parseURLSearchParamsForGetLaunchParams(window.location.search);

  // В dev launch-параметры приходят из mock-bridge, а не из URL:
  // платформа мока — desktop_web, поэтому рендерим vkcom-интерфейс.
  const platform =
    vk_platform === "desktop_web" || import.meta.env.DEV ? "vkcom" : undefined;

  return (
    <ConfigProvider
      colorScheme={vkBridgeColorScheme}
      platform={vk_platform === "desktop_web" ? "vkcom" : undefined}
      isWebView={bridge.isWebView()}
      hasCustomPanelHeaderAfter={bridge.isWebView()}
    >
      <AdaptivityProvider {...vkBridgeAdaptivityProps}>
        <RouterProvider router={router}>
          <QueryClientProvider client={queryClient}>
            {/* ErrorBoundary — самый внешний рубеж: ловит ошибки самого AppRoot.
                Его fallback — чистый HTML без VKUI (иначе зависит от AppRoot). */}
            <ErrorBoundary>
              <AppRoot mode="full" safeAreaInsets={vkBridgeInsets}>
                <SnackbarProvider>
                  <ModalProvider>
                    <AuthGate>
                      <WsProvider>
                        <GlobalWsListener />
                        {children}
                      </WsProvider>
                    </AuthGate>
                  </ModalProvider>
                </SnackbarProvider>
              </AppRoot>
            </ErrorBoundary>
          </QueryClientProvider>
        </RouterProvider>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};

