// backend/src/utils/prisma-errors.ts
// Prisma 7 (pg driver-адаптер): у P2002 в meta нет `target` (массива полей
// индекса, как было в Prisma 5). Сырые данные драйвера PG теперь лежат в
// meta.driverAdapterError.cause, где constraint.index — имя нарушенного
// unique-индекса.
import type { Prisma } from "../generated/prisma/client.js";

/**
 * Имя нарушенного unique-индекса при P2002 (например,
 * "active_seat_booking"). Возвращает undefined, если форма ошибки не
 * содержит адаптер-данных — вызывающий код обрабатывает это как
 * «неизвестный индекс» (общий конфликт).
 */
export function getUniqueConstraintName(
  error: Prisma.PrismaClientKnownRequestError
): string | undefined {
  const driverError = error.meta?.driverAdapterError as
    | { cause?: { constraint?: { index?: string } } }
    | undefined;
  return driverError?.cause?.constraint?.index;
}
