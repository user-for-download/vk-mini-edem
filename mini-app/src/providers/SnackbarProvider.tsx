// mini-app/src/providers/SnackbarProvider.tsx
import { createContext, useCallback, useContext, useRef, type FC, type PropsWithChildren } from "react";
import { useSnackbarManager } from "@vkontakte/vkui";
import { Icon28CheckCircleOutline, Icon28ErrorOutline, Icon28InfoCircleOutline } from "@vkontakte/icons";

export type SnackbarType = "success" | "error" | "info";

export interface SnackbarItem {
  type: SnackbarType;
  title: string;
  subtitle?: string;
  dedupeKey?: string;
}

interface SnackbarApi {
  enqueue: (item: SnackbarItem) => void;
  dismiss: () => void;
}

const SnackbarContext = createContext<SnackbarApi | null>(null);

export const useSnackbar = (): SnackbarApi => {
  const api = useContext(SnackbarContext);
  if (!api) {
    throw new Error("useSnackbar must be used within SnackbarProvider");
  }
  return api;
};

export const SnackbarProvider: FC<PropsWithChildren> = ({ children }) => {
  const [api, contextHolder] = useSnackbarManager();
  const lastDedupeKey = useRef<string | null>(null);

  const enqueue = useCallback(
    (item: SnackbarItem) => {
      if (item.dedupeKey && item.dedupeKey === lastDedupeKey.current) {
        return;
      }
      if (item.dedupeKey) {
        lastDedupeKey.current = item.dedupeKey;
      }

      const icon =
        item.type === "success" ? (
          <Icon28CheckCircleOutline fill="var(--vkui--color_icon_positive)" />
        ) : item.type === "error" ? (
          <Icon28ErrorOutline fill="var(--vkui--color_icon_negative)" />
        ) : (
          <Icon28InfoCircleOutline fill="var(--vkui--color_icon_accent)" />
        );

      api.open({
        children: item.title,
        subtitle: item.subtitle,
        before: icon,
        duration: 4000,
      });
    },
    [api]
  );

  const dismiss = useCallback(() => {
    api.closeAll();
  }, [api]);

  return (
    <SnackbarContext.Provider value={{ enqueue, dismiss }}>
      {children}
      {contextHolder}
    </SnackbarContext.Provider>
  );
};
