import type { WsClientEvent } from "@edem/contracts";

/**
 * Верхняя граница очереди исходящих WS-сообщений.
 *
 * Сообщения, вызванные через `send` при закрытом сокете, копятся здесь
 * и отправляются FIFO-порядком после `auth:ok`. При переполнении самое
 * старое сообщение отбрасывается (с предупреждением в консоль) —
 * очередь никогда не растёт бесконечно и не роняет приложение.
 */
export const WS_SEND_QUEUE_MAX = 50;

export interface EnqueueResult {
  queue: WsClientEvent[];
  /** True, если из-за переполнения отброшено самое старое сообщение. */
  dropped: boolean;
}

/**
 * Добавляет событие в конец очереди, сохраняя порядок отправки.
 * При переполнении отбрасывает самое старое сообщение (FIFO-cap).
 * Чистая функция: входной массив не мутируется.
 */
export function enqueueOutbox(queue: WsClientEvent[], event: WsClientEvent): EnqueueResult {
  if (queue.length >= WS_SEND_QUEUE_MAX) {
    return { queue: [...queue.slice(1), event], dropped: true };
  }
  return { queue: [...queue, event], dropped: false };
}

export interface DrainResult {
  /** События в порядке отправки (FIFO). */
  events: WsClientEvent[];
  queue: WsClientEvent[];
}

/**
 * Забирает все накопленные события для отправки, очередь становится пустой.
 * Чистая функция: входной массив не мутируется.
 */
export function drainOutbox(queue: WsClientEvent[]): DrainResult {
  return { events: [...queue], queue: [] };
}
