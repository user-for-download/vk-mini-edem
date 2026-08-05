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
        return failureCount < 2;
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
            <ErrorBoundary>
              <AuthGate>
                <WsProvider>
                  <GlobalWsListener />
                  <AppRoot mode="full" safeAreaInsets={vkBridgeInsets}>
                    {children}
                  </AppRoot>
                </WsProvider>
              </AuthGate>
            </ErrorBoundary>
          </QueryClientProvider>
        </RouterProvider>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};

