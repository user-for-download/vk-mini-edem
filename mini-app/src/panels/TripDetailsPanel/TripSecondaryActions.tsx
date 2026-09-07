// mini-app/src/panels/TripDetailsPanel/TripSecondaryActions.tsx
import type { FC } from "react";
import { Box, Button, ButtonGroup } from "@vkontakte/vkui";
import {
  Icon20ReportOutline,
  Icon20ShareExternalOutline,
} from "@vkontakte/icons";

export interface TripSecondaryActionsProps {
  onShare: () => void;
  onReport: () => void;
  /**
   * Показывать ли кнопку жалобы. Бэкенд (`POST /reports` → 403)
   * принимает жалобы только от участников поездки (водитель или
   * пассажир с бронью), поэтому посторонним кнопку не показываем.
   * Поделиться доступно всем — ссылка содержит только маршрут.
   */
  canReport: boolean;
  /**
   * Жалоба на этот объект уже отправлена (`GET /reports` — сервер
   * источник правды). Кнопка переименовывается в «Жалоба уже
   * отправлена» и гаснет — модалка вовсе не открывается.
   */
  alreadyReported: boolean;
}

/**
 * Inline-секция вторичных действий поездки (Поделиться / Пожаловаться).
 * Живёт внизу панели — верхний правый угол шапки занят системными
 * кнопками VK-клиента, поэтому kebab-меню там невозможно.
 */
export const TripSecondaryActions: FC<TripSecondaryActionsProps> = ({
  onShare,
  onReport,
  canReport,
  alreadyReported,
}) => (
  <Box padding="system">
    <ButtonGroup mode="vertical" gap="m" stretched>
      <Button
        size="m"
        mode="secondary"
        stretched
        before={<Icon20ShareExternalOutline />}
        onClick={onShare}
      >
        Поделиться поездкой
      </Button>
      {canReport && (
        <Button
          size="m"
          mode="secondary"
          stretched
          before={<Icon20ReportOutline />}
          disabled={alreadyReported}
          onClick={onReport}
        >
          {alreadyReported ? "Жалоба уже отправлена" : "Пожаловаться на поездку"}
        </Button>
      )}
    </ButtonGroup>
  </Box>
);
