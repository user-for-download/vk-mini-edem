// mini-app/src/helpers/transformVKBridgeAdaptivity.ts
//
// Официальный хелпер из инструкции интеграции VK Mini Apps (vkui.io):
// конвертирует данные adaptivity из VK Bridge в пропсы AdaptivityProvider.
//
// - `adaptive`: viewport → viewWidth/viewHeight библиотечными функциями
//   (брейкпоинты VKUI: 320/768/1024/1280 по ширине, 415/720 по высоте —
//   ручные пороги занижали класс и пропускали viewHeight);
// - `force_mobile` / `force_mobile_compact`: всегда мобильный viewWidth;
//   compact дополнительно задаёт density="compact" (v8: density вместо
//   устаревших sizeX/sizeY);
// - `null` (вне VK-окружения): пустые пропсы — AdaptivityProvider на дефолтах.
import {
  type AdaptivityProps,
  getViewWidthByViewportWidth,
  getViewHeightByViewportHeight,
  ViewWidth,
} from "@vkontakte/vkui";
import type { UseAdaptivity } from "@vkontakte/vk-bridge-react";

export function transformVKBridgeAdaptivity(
  adaptivity: UseAdaptivity,
): AdaptivityProps {
  switch (adaptivity.type) {
    case "adaptive":
      return {
        viewWidth: getViewWidthByViewportWidth(adaptivity.viewportWidth),
        viewHeight: getViewHeightByViewportHeight(adaptivity.viewportHeight),
      };
    case "force_mobile":
    case "force_mobile_compact":
      return {
        viewWidth: ViewWidth.MOBILE,
        density: adaptivity.type === "force_mobile_compact" ? "compact" : "regular",
      };
    default:
      return {};
  }
}
