// mini-app/src/panels/TripDetailsPanel/TripActionsSheet.tsx
import type { FC, RefObject } from "react";
import {
  ActionSheet,
  ActionSheetItem,
  AdaptiveIconRenderer,
} from "@vkontakte/vkui";
import {
  Icon20ReportOutline,
  Icon20ShareExternalOutline,
  Icon28Report,
  Icon28ShareExternal,
} from "@vkontakte/icons";

export interface TripActionsSheetProps {
  /** Якорь kebab-кнопки для десктопного menu-режима. */
  toggleRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onShare: () => void;
  onReport: () => void;
}

/**
 * Kebab-меню опций поездки: «Поделиться» + «Пожаловаться».
 * onImmediateClick — реакция до анимации закрытия (onClick по докам
 * приходит после, с пустым currentTarget). Закрытие — только через
 * onClose родителя (условный рендер удаляет sheet из DOM).
 */
export const TripActionsSheet: FC<TripActionsSheetProps> = ({
  toggleRef,
  onClose,
  onShare,
  onReport,
}) => {
  return (
    <ActionSheet
      onClose={onClose}
      onClosed={onClose}
      toggleRef={toggleRef}
      mode="menu"
      placement="bottom"
      slotProps={{ iosCloseItem: { children: "Отмена" } }}
    >
      <ActionSheetItem
        before={
          <AdaptiveIconRenderer
            IconCompact={Icon20ShareExternalOutline}
            IconRegular={Icon28ShareExternal}
          />
        }
        onImmediateClick={onShare}
      >
        Поделиться поездкой
      </ActionSheetItem>
      <ActionSheetItem
        before={
          <AdaptiveIconRenderer
            IconCompact={Icon20ReportOutline}
            IconRegular={Icon28Report}
          />
        }
        onImmediateClick={onReport}
      >
        Пожаловаться на поездку
      </ActionSheetItem>
    </ActionSheet>
  );
};
