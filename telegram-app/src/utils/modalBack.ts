import { useEffect } from "react";

/**
 * Стек BackButton-хендлеров для state-модалок (паттерн useTelegramBackButton
 * из примера edem-telegram-mini-app): верхняя модалка перехватывает Back,
 * Shell.handleBack спрашивает стек первым (handleModalBack) и навигирует
 * только когда стек пуст. Route-модалки (`/trips/:id`) закрываются обычной
 * навигацией назад и стек не используют.
 */
const stack: Array<() => void> = [];

export function pushModalBackHandler(handler: () => void): () => void {
  stack.push(handler);
  return () => {
    const index = stack.lastIndexOf(handler);
    if (index >= 0) stack.splice(index, 1);
  };
}

/**
 * Выполнить верхний хендлер стека. Возвращает true, если модалка
 * перехватила Back (навигация не нужна).
 */
export function handleModalBack(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top();
  return true;
}

/** Подписка модалки на BackButton пока она открыта. */
export function useModalBack(onBack: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    return pushModalBackHandler(onBack);
  }, [onBack, enabled]);
}
