// mini-app/src/helpers/confirmQueue.ts

/**
 * Сериализация confirm-диалогов (ConfirmProvider): повторный вызов во время
 * открытого/закрывающегося алерта встаёт в очередь и открывается только
 * после завершения предыдущего. Без этого второй confirm подряд
 * детерминированно возвращал false (алерт ещё в анимации закрытия).
 */
export function chainConfirmTask<T>(
  tail: Promise<void>,
  open: () => Promise<T>,
): { task: Promise<T>; tail: Promise<void> } {
  const task = tail.then(open);
  return { task, tail: task.then(undefined, () => undefined) };
}
