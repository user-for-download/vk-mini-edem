import { useCallback } from "react";
import {
  useEnableSwipeBack,
  useFirstPageCheck,
  useRouteNavigator,
} from "@vkontakte/vk-mini-apps-router";

/**
 * Безопасный маршрут для кнопки «Назад» на первой записи истории.
 *
 * Вход по deep-link (или прямому хешу) создаёт историю из одной записи:
 * обычный back() в таком состоянии закрывает мини-апп или показывает
 * пустой экран. Вместо этого ведём пользователя на главную.
 */
export const SAFE_BACK_FALLBACK_ROUTE = "/";

/** Решение навигации для нажатия «Назад» (чистая функция — легко тестируется). */
export type BackNavigation =
  | { kind: "back" }
  | { kind: "replace"; route: string };

/**
 * Выбирает навигацию для нажатия «Назад».
 *
 * @param isFirstPage — текущая страница первая в истории (см. useFirstPageCheck)
 * @param fallback — безопасный маршрут для первой записи истории
 */
export function resolveBackNavigation(
  isFirstPage: boolean,
  fallback: string = SAFE_BACK_FALLBACK_ROUTE,
): BackNavigation {
  if (isFirstPage) return { kind: "replace", route: fallback };
  return { kind: "back" };
}

/** Минимальный интерфейс навигатора, достаточный для безопасного «Назад». */
export interface SafeBackNavigator {
  back: () => void;
  replace: (path: string) => void | Promise<void>;
}

/**
 * Выполняет безопасное «Назад»: обычная история — back(),
 * первая запись истории — replace на fallback (без выхода из мини-аппа).
 */
export function performBackNavigation(
  routeNavigator: SafeBackNavigator,
  isFirstPage: boolean,
  fallback: string = SAFE_BACK_FALLBACK_ROUTE,
): void {
  const decision = resolveBackNavigation(isFirstPage, fallback);
  if (decision.kind === "replace") {
    void routeNavigator.replace(decision.route);
    return;
  }
  routeNavigator.back();
}

/**
 * Хук безопасного «Назад» для экранов, открытых deep-link'ом.
 *
 * Обычная навигация внутри приложения не меняется (back()),
 * на первой записи истории ведёт на fallback вместо выхода из мини-аппа.
 */
export function useSafeBack(fallback: string = SAFE_BACK_FALLBACK_ROUTE): () => void {
  const routeNavigator = useRouteNavigator();
  const isFirstPage = useFirstPageCheck();
  return useCallback(() => {
    performBackNavigation(routeNavigator, isFirstPage, fallback);
  }, [routeNavigator, isFirstPage, fallback]);
}

/**
 * Синхронизирует свайп-назад VK Mini Apps с роутером приложения.
 */
export function SwipeBackSync() {
  useEnableSwipeBack();
  return null;
}
