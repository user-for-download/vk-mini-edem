import type { FC, PropsWithChildren } from "react";
import { AdaptivityProvider, AppRoot, ConfigProvider } from "@vkontakte/vkui";
import { RouterProvider } from "@vkontakte/vk-mini-apps-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import vkBridge, { parseURLSearchParamsForGetLaunchParams } from "@vkontakte/vk-bridge";
import { useAppearance, useInsets, useAdaptivity } from "@vkontakte/vk-bridge-react";

import { transformVKBridgeAdaptivity } from "@/helpers/transformVKBridgeAdaptivity";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthGate } from "@/components/AuthGate";
import { router } from "@/router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
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
      isWebView={vkBridge.isWebView()}
      hasCustomPanelHeaderAfter={vkBridge.isWebView()}
    >
      <AdaptivityProvider {...vkBridgeAdaptivityProps}>
        <RouterProvider router={router}>
          <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
              <AuthGate>
                <AppRoot mode="full" safeAreaInsets={vkBridgeInsets}>
                  {children}
                </AppRoot>
              </AuthGate>
            </ErrorBoundary>
          </QueryClientProvider>
        </RouterProvider>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};
