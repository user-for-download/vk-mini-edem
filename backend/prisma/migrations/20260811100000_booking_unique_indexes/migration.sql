-- Именованные partial unique индексы для защиты от гонок бронирования.
--
-- Prisma не умеет выражать partial unique индексы в schema.prisma
-- (нет поддержки `where` в @@unique), поэтому они создаются SQL-миграцией.
-- Поля (tripId, seat) / (tripId, passengerId) остаются в schema.prisma как
-- обычные @@index — для query performance.
--
-- Индексы уникальны ТОЛЬКО для активных броней (pending, confirmed):
-- declined/cancelled не занимают слот и не мешают повторному бронированию.
--
-- Имена индексов возвращаются в Prisma-ошибке P2002 как meta.constraint
-- и используются в POST /api/v1/bookings для классификации конфликтов.

-- Старый составной индекс (tripId, seat, status) не уникален и теперь
-- не нужен: (tripId, seat) — префикс, покрывающий те же запросы.
DROP INDEX IF EXISTS "Booking_tripId_seat_status_idx";

-- Один пассажир не может занять одно и то же место дважды (гонка броней).
CREATE UNIQUE INDEX IF NOT EXISTS "active_seat_booking"
  ON "Booking"("tripId", "seat")
  WHERE "status" IN ('pending', 'confirmed');

-- Один пассажир = одна активная бронь на поездку.
CREATE UNIQUE INDEX IF NOT EXISTS "active_passenger_booking"
  ON "Booking"("tripId", "passengerId")
  WHERE "status" IN ('pending', 'confirmed');
