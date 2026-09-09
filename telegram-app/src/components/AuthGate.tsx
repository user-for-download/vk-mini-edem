import { type FC, type PropsWithChildren, useEffect } from "react";
import { Button, Placeholder, Spinner } from "@telegram-apps/telegram-ui";
import { useAuthStore } from "@/store/useAuthStore";
import { apiClient } from "@/api/client";

/**
 * Гейт авторизации (порт mini-app AuthGate на telegram-ui).
 * Запускает bootstrap при первом рендере, показывает спиннер до завершения,
 * терминирующие экраны для бана/удаления/ошибки, подписывается на события
 * apiClient (silent refresh, session expired, banned) и сворачивание WebView.
 */
export const AuthGate: FC<PropsWithChildren> = ({ children }) => {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const banReason = useAuthStore((state) => state.banReason);

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
   * чтобы приложение не застревало с мёртвыми токенами.
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

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (status === "idle" || status === "initializing") {
    return <Spinner size="l" />;
  }

  if (status === "banned") {
    return (
      <Placeholder
        header="Аккаунт заблокирован"
        description={`Причина: ${banReason || "Причина не указана"}`}
        action={
          <Button size="l" stretched>
            Обратная связь
          </Button>
        }
      />
    );
  }

  if (status === "deleted") {
    return (
      <Placeholder
        header="Профиль удалён"
        description="Аккаунт анонимизирован. Поездки и отзывы сохранены без вашего имени. Восстановление невозможно."
      />
    );
  }

  if (status === "error" || status === "unauthenticated") {
    return (
      <Placeholder
        header="Ошибка авторизации"
        description="Не удалось проверить данные авторизации. Проверьте подключение к интернету."
        action={
          <Button size="l" stretched onClick={() => void bootstrap()}>
            Попробовать снова
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
};
