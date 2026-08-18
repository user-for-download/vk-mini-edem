// mini-app/src/components/AuthGate.tsx
import { type FC, type PropsWithChildren, useEffect } from "react";
import { ScreenSpinner, Placeholder, Button, Panel, View } from "@vkontakte/vkui";
import { useAuthStore } from "@/store/useAuthStore";
import { apiClient } from "@/api/client";
import { bridge, requestVkMessagesPermission } from "@/helpers/bridge";

/**
 * ID сообщества ВК, от имени которого отправляются сообщения.
 * Задаётся через VITE_VK_GROUP_ID в .env (prod). Если не задан —
 * разрешение не запрашиваем, бэкенд тихо пропустит отправку.
 */
const VK_GROUP_ID = Number(import.meta.env.VITE_VK_GROUP_ID || 0);

/**
 * Обёртка, которая запускает авторизацию при первом рендере
 * и показывает спиннер, пока bootstrap не завершится.
 */
export const AuthGate: FC<PropsWithChildren> = ({ children }) => {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    if (status === "idle") {
      void bootstrap();
    }
  }, [status, bootstrap]);

  /**
   * Подписка на тихое обновление токенов в apiClient (silent refresh по 401).
   * Без этого Zustand-стор хранит отозванный refresh-токен, и ручной
   * refreshSession() (возврат из фона) приводит к ложному логауту.
   */
  useEffect(() => {
    return apiClient.onTokenUpdate((tokens) => {
      const state = useAuthStore.getState();
      // Не воскрешаем сессию, если пользователь вышел (clearSession) или
      // авторизация в состоянии ошибки — refresh мог стартовать ДО логаута.
      if (state.status === "unauthenticated" || state.status === "error") {
        return;
      }
      useAuthStore.setState({
        status: "authenticated",
        session: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: Date.now() + tokens.expiresIn * 1000,
        },
      });
    });
  }, []);

  /**
   * Refresh-токен отозван/истёк (401 от /auth/refresh): сбрасываем сессию,
   * чтобы приложение не застревало с мёртвыми токенами. Пользователь увидит
   * экран ошибки авторизации и сможет авторизоваться заново.
   */
  useEffect(() => {
    return apiClient.onSessionExpired(() => {
      const state = useAuthStore.getState();
      if (state.status === "authenticated" || state.status === "background") {
        void state.clearSession("Session expired");
      }
    });
  }, []);

  /**
   * После успешной авторизации запрашиваем разрешение на сообщения
   * от имени сообщества (нужно для VK API messages.send). В dev пропускаем.
   * Результат не критичен: если пользователь отказал — бэкенд просто
   * не сможет отправить сообщение, приложение продолжит работать.
   */
  useEffect(() => {
    if (status !== "authenticated" || VK_GROUP_ID <= 0) {
      return;
    }
    void requestVkMessagesPermission(VK_GROUP_ID).then((granted) => {
      if (!granted) {
        console.info("[Bridge] Messages from group not allowed");
      }
    });
  }, [status]);

  useEffect(() => {
    const handleVisibility = () => {
      useAuthStore.getState().handleBackgroundState(document.visibilityState === "hidden");
    };
    const handleBridgeEvent: Parameters<typeof bridge.subscribe>[0] = (event) => {
      if (event.detail.type === "VKWebAppViewHide") {
        useAuthStore.getState().handleBackgroundState(true);
      } else if (event.detail.type === "VKWebAppViewRestore") {
        useAuthStore.getState().handleBackgroundState(false);
      }
    };
    bridge.subscribe(handleBridgeEvent);

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      bridge.unsubscribe(handleBridgeEvent);
    };
  }, []);

  if (status === "idle" || status === "initializing") {
    return <ScreenSpinner />;
  }

  if (status === "error" || status === "unauthenticated") {
    return (
      <View activePanel="auth-error">
        <Panel id="auth-error">
          <Placeholder
            title="Ошибка авторизации"
            action={
              <Button size="m" onClick={() => void bootstrap()}>
                Попробовать снова
              </Button>
            }
          >
            Не удалось проверить данные авторизации. Проверьте подключение к интернету.
          </Placeholder>
        </Panel>
      </View>
    );
  }

  return <>{children}</>;
};
