// mini-app/src/providers/ModalProvider.tsx
import { createContext, useContext, type FC, type PropsWithChildren } from "react";
import { useModalManager } from "@vkontakte/vkui";

type ModalApi = ReturnType<typeof useModalManager>[0];

const ModalContext = createContext<ModalApi | null>(null);

/**
 * Доступ к API модальных окон (useModalManager) из любого места приложения.
 */
export const useModalApi = (): ModalApi => {
  const api = useContext(ModalContext);
  if (!api) {
    throw new Error("useModalApi must be used within ModalProvider");
  }
  return api;
};

/**
 * Единая точка управления модальными окнами вместо устаревшего ModalRoot.
 * Рендерит contextHolder (внутренний ModalRoot) рядом с children.
 */
export const ModalProvider: FC<PropsWithChildren> = ({ children }) => {
  const [api, contextHolder] = useModalManager({
    saveHistory: true,
  });

  return (
    <ModalContext.Provider value={api}>
      {children}
      {contextHolder}
    </ModalContext.Provider>
  );
};
