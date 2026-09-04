// backend/src/cities/counters.ts
//
// Денормализованный счётчик City.tripsCount: единая точка изменения.
//
// Семантика (F17): tripsCount = число НЕ отменённых поездок, ссылающихся
// на город через FK (fromCityId/toCityId). Отмена поездки декрементирует
// счётчик обоих городов; завершение — нет (история/статистика сохраняется).
// Legacy-поездки без FK (NULL) не считаются — симметрично инкременту.
//
// Guard от отрицательных значений — двухуровневый:
//   1. код: декремент только через guarded updateMany (tripsCount > 0);
//   2. БД: CHECK City_tripsCount_nonnegative (миграция *city_tripscount_guard).
import type {
  Prisma,
  PrismaClient,
} from "../generated/prisma/client.js";

type CityCounterClient = Prisma.TransactionClient | PrismaClient;

const nonNullIds = (
  fromCityId: string | null,
  toCityId: string | null
): string[] =>
  [fromCityId, toCityId].filter((id): id is string => id !== null);

/**
 * Инкремент счётчиков обоих городов при создании поездки.
 * Fail-loud через update: FK только что проверены, висячих id быть не должно.
 */
export async function incrementCityTripsCount(
  client: CityCounterClient,
  fromCityId: string | null,
  toCityId: string | null
): Promise<void> {
  await Promise.all(
    nonNullIds(fromCityId, toCityId).map((id) =>
      client.city.update({
        where: { id },
        data: { tripsCount: { increment: 1 } },
      })
    )
  );
}

/**
 * Декремент счётчиков обоих городов при отмене поездки.
 * Атомарный guard `tripsCount > 0`: счётчик никогда не уходит в минус —
 * ни при гонках, ни на дрейфованных (заниженных вручную) данных.
 */
export async function decrementCityTripsCount(
  client: CityCounterClient,
  fromCityId: string | null,
  toCityId: string | null
): Promise<void> {
  await Promise.all(
    nonNullIds(fromCityId, toCityId).map((id) =>
      client.city.updateMany({
        where: { id, tripsCount: { gt: 0 } },
        data: { tripsCount: { decrement: 1 } },
      })
    )
  );
}

/**
 * Полный пересчёт tripsCount по ground truth (FK + статус).
 * Чинит дрейф: ручные правки, прямые удаления Trip в обход API, сид
 * без FK-связей. Идемпотентен — безопасно гонять скриптом и в afterEach тестов.
 */
export async function recomputeCityTripsCount(
  client: CityCounterClient
): Promise<{ updated: number }> {
  const [fromGroups, toGroups, cities] = await Promise.all([
    client.trip.groupBy({
      by: ["fromCityId"],
      where: { fromCityId: { not: null }, status: { not: "cancelled" } },
      _count: { _all: true },
    }),
    client.trip.groupBy({
      by: ["toCityId"],
      where: { toCityId: { not: null }, status: { not: "cancelled" } },
      _count: { _all: true },
    }),
    client.city.findMany({ select: { id: true } }),
  ]);

  const counts = new Map<string, number>();
  for (const group of fromGroups) {
    if (group.fromCityId === null) continue;
    counts.set(
      group.fromCityId,
      (counts.get(group.fromCityId) ?? 0) + group._count._all
    );
  }
  for (const group of toGroups) {
    if (group.toCityId === null) continue;
    counts.set(
      group.toCityId,
      (counts.get(group.toCityId) ?? 0) + group._count._all
    );
  }

  await Promise.all(
    cities.map((city) =>
      client.city.update({
        where: { id: city.id },
        data: { tripsCount: counts.get(city.id) ?? 0 },
      })
    )
  );

  return { updated: cities.length };
}
