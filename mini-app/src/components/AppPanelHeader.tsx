// mini-app/src/components/AppPanelHeader.tsx
import { type FC, type PropsWithChildren } from "react";
import { PanelHeader, PanelHeaderProps } from "@vkontakte/vkui";

/**
 * Единый PanelHeader для всех экранов приложения.
 *
 * Настройки safe area задаются на уровне AppRoot.
 */
export const AppPanelHeader: FC<PropsWithChildren<PanelHeaderProps>> = ({
  children,
  ...restProps
}) => {
  return <PanelHeader {...restProps}>{children}</PanelHeader>;
};
