// mini-app/src/components/AuthGate.tsx
import { type FC, type PropsWithChildren, useEffect } from "react";
import { ScreenSpinner, Placeholder, Button, Panel, View } from "@vkontakte/vkui";
import { useAuthStore } from "@/store/useAuthStore";

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
