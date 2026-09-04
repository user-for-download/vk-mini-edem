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
  actionLabel?: string;
  onActionClick?: () => void;
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
  // dedupeKey → время последнего показа: одинаковый снекбар не спамится
  // в течение окна, но может появиться снова позже (в отличие от
  // бессрочного запоминания одного ключа).
  const lastDedupeAt = useRef<Map<string, number>>(new Map());
  const DEDUPE_WINDOW_MS = 5000;

  const enqueue = useCallback(
    (item: SnackbarItem) => {
      if (item.dedupeKey) {
        const now = Date.now();
        const last = lastDedupeAt.current.get(item.dedupeKey);
        if (last !== undefined && now - last < DEDUPE_WINDOW_MS) {
          return;
        }
        // Ключи содержат несвязанные id (booking/trip) — без очистки Map
        // росла бы бесконечно в долгоживущей WebView-сессии. Выкидываем
        // протухшие записи (они уже не влияют на дедупликацию).
        for (const [key, at] of lastDedupeAt.current) {
          if (now - at >= DEDUPE_WINDOW_MS) {
            lastDedupeAt.current.delete(key);
          }
        }
        lastDedupeAt.current.set(item.dedupeKey, now);
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
        action: item.actionLabel,
        onActionClick: item.onActionClick,
        placement: "top",
        slotProps: {
          root: {
            style: {
              inlineSize: "100vw",
              maxInlineSize: "none",
            },
          },
        },
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
