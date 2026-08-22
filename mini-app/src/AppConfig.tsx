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
import { ConfirmProvider } from "@/providers/ConfirmProvider";
import { ModuleLoadErrorListener } from "@/components/ModuleLoadErrorListener";

import { ApiError } from "@/api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Детерминированные ошибки — ретрай бессмыслен.
          if (error.code === "INVALID_RESPONSE") {
            return false;
          }
          // 4xx не ретраим, КРОМЕ 408 (таймаут запроса) — это транзитентный
          // сетевой сбой, самый ретрай-подходящий класс ошибок.
          if (
            error.status &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408
          ) {
            return false;
          }
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

  const mockPlatform = import.meta.env.DEV ? import.meta.env.VITE_MOCK_PLATFORM : undefined;
  const platform =
    vk_platform === "desktop_web" || mockPlatform === "vkcom" ? "vkcom" : undefined;

  return (
    <ConfigProvider
      colorScheme={vkBridgeColorScheme}
      platform={platform}
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
                  <ModuleLoadErrorListener />
                  <ConfirmProvider>
                    <ModalProvider>
                      <AuthGate>
                        <WsProvider>
                          <GlobalWsListener />
                          {children}
                        </WsProvider>
                      </AuthGate>
                    </ModalProvider>
                  </ConfirmProvider>
                </SnackbarProvider>
              </AppRoot>
            </ErrorBoundary>
          </QueryClientProvider>
        </RouterProvider>
      </AdaptivityProvider>
    </ConfigProvider>
  );
};
