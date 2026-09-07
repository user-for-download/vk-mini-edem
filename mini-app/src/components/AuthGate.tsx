// mini-app/src/components/AuthGate.tsx
import { type FC, type PropsWithChildren, useEffect } from "react";
import {
  ScreenSpinner,
  Placeholder,
  Button,
  Panel,
  PanelHeader,
  View,
} from "@vkontakte/vkui";
import { Icon56LockOutline, Icon56ErrorOutline, Icon56DeleteOutline } from "@vkontakte/icons";
import { useAuthStore } from "@/store/useAuthStore";
import { apiClient } from "@/api/client";
import { bridge } from "@/helpers/bridge";
import { useModalApi } from "@/providers/ModalProvider";
import { openFeedbackModal } from "@/helpers/feedbackModal";

/**
 * Обёртка, которая запускает авторизацию при первом рендере
 * и показывает спиннер, пока bootstrap не завершится.
 */
export const AuthGate: FC<PropsWithChildren> = ({ children }) => {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const banReason = useAuthStore((state) => state.banReason);
  const modalApi = useModalApi();

  /**
   * Обратная связь с экрана бана: открывает FeedbackModal с предзаполненной
   * темой «Обжалование блокировки». Отправка идёт без токена — через
   * публичный appeal-эндпоинт (подпись VK launch-параметров).
   */
  const handleOpenFeedback = () => {
    void openFeedbackModal(modalApi, {
      initialSubject: "Обжалование блокировки",
    });
  };

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
      // Не воскрешаем сессию, если пользователь вышел (clearSession),
      // удалил аккаунт или авторизация в состоянии ошибки — refresh мог
      // стартовать ДО логаута.
      if (state.status === "unauthenticated" || state.status === "error" || state.status === "deleted") {
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
   * Бан обнаружен во время активной сессии (403 FORBIDDEN от /auth/refresh).
   * Сразу выставляем status="banned" — иначе пользователь останется в
   * «Ошибка авторизации» и не увидит причину.
   */
  useEffect(() => {
    return apiClient.onBanned((reason) => {
      useAuthStore.setState({
        status: "banned",
        user: null,
        session: null,
        banReason: reason ?? null,
      });
    });
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      useAuthStore
        .getState()
        .handleBackgroundState(document.visibilityState === "hidden");
    };
    const handleBridgeEvent: Parameters<typeof bridge.subscribe>[0] = (
      event,
    ) => {
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
    return <ScreenSpinner aria-label="Проверка авторизации" />;
  }

  if (status === "banned") {
    return (
      <View activePanel="auth-banned">
        <Panel id="auth-banned" aria-labelledby="auth-banned-title">
          <PanelHeader>Вход</PanelHeader>
          <Placeholder
            icon={<Icon56LockOutline />}
            title="Аккаунт заблокирован"
            action={
              <Button size="l" mode="primary" onClick={handleOpenFeedback}>
                Обратная связь
              </Button>
            }
          >
            Причина: {banReason || "Причина не указана"}
          </Placeholder>
        </Panel>
      </View>
    );
  }

  if (status === "deleted") {
    return (
      <View activePanel="auth-deleted">
        <Panel id="auth-deleted" aria-labelledby="auth-deleted-title">
          <PanelHeader>Вход</PanelHeader>
          <Placeholder
            icon={<Icon56DeleteOutline />}
            title="Профиль удалён"
          >
            Аккаунт анонимизирован. Поездки и отзывы сохранены без вашего
            имени. Восстановление невозможно.
          </Placeholder>
        </Panel>
      </View>
    );
  }

  if (status === "error" || status === "unauthenticated") {
    return (
      <View activePanel="auth-error">
        <Panel id="auth-error" aria-labelledby="auth-error-title">
          <PanelHeader>Вход</PanelHeader>
          <Placeholder
            icon={<Icon56ErrorOutline />}
            title="Ошибка авторизации"
            action={
              <Button size="l" onClick={() => void bootstrap()}>
                Попробовать снова
              </Button>
            }
          >
            Не удалось проверить данные авторизации. Проверьте подключение к
            интернету.
          </Placeholder>
        </Panel>
      </View>
    );
  }

  return <>{children}</>;
};
