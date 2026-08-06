// mini-app/src/helpers/transformVKBridgeAdaptivity.ts
import type { AdaptivityProps } from "@vkontakte/vkui";

/**
 * Преобразует данные adaptivity из VK Bridge в формат VKUI.
 */
export function transformVKBridgeAdaptivity(
  adaptivity: { type?: string | null; hasMouse?: boolean; isDesktop?: boolean } | undefined
): AdaptivityProps {
  if (!adaptivity) {
    return {};
  }
  return {
    hasMouse: adaptivity.hasMouse,
    deviceType: adaptivity.isDesktop ? "desktop" : "mobile",
  } as any;
}
