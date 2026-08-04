// mini-app/src/components/AppPanelHeader.tsx
import { type FC, type PropsWithChildren } from "react";
import { PanelHeader, PanelHeaderProps } from "@vkontakte/vkui";

/**
 * Единый PanelHeader для всех экранов приложения.
 *
 * В WebView (VK Mini Apps) автоматически добавляет системный отступ,
 * чтобы контент не перекрывался статус-баром.
 */
export const AppPanelHeader: FC<PropsWithChildren<PanelHeaderProps>> = ({
  children,
  ...restProps
}) => {
  return <PanelHeader {...restProps}>{children}</PanelHeader>;
};
