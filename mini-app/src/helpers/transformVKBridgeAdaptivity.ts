// mini-app/src/helpers/transformVKBridgeAdaptivity.ts
import type { AdaptivityProps } from "@vkontakte/vkui";
import type { UseAdaptivity } from "@vkontakte/vk-bridge-react";

/**
 * Преобразует данные adaptivity из VK Bridge в формат VKUI.
 *
 * VK Bridge отдаёт тип (adaptive/force_mobile/force_mobile_compact) и ширину
 * окна, VKUI ожидает числовые брейкпоинты viewWidth
 * (3 — small tablet, 4 — tablet, 5 — desktop).
 */
export function transformVKBridgeAdaptivity(
  adaptivity: UseAdaptivity
): AdaptivityProps {
  if (adaptivity.type === null) {
    return {};
  }
  if (adaptivity.type !== "adaptive") {
    // force_mobile / force_mobile_compact — всегда мобильный интерфейс
    return { viewWidth: 2 };
  }
  const vw = adaptivity.viewportWidth;
  return { viewWidth: vw >= 1024 ? 5 : vw >= 768 ? 4 : 3 };
}