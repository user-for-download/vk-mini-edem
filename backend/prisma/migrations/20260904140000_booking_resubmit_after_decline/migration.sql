-- F15: повторная подача на слот после отклонения (declined).
--
-- Partial unique индексы active_seat_booking / active_passenger_booking
-- (миграция 20260811100000_booking_unique_indexes) намеренно уникальны
-- ТОЛЬКО для активных броней (pending, confirmed): declined/cancelled слот
-- не занимают и повторному бронированию не мешают. Pre-check'и
-- POST /api/v1/bookings используют тот же предикат через общий
-- ACTIVE_BOOKING_STATUSES (см. backend/src/bookings/index.ts).
--
-- Эта миграция идемпотентно фиксирует оба индекса (IF NOT EXISTS):
-- на здоровой БД — no-op, deploy всегда exits 0. DML нет, существующие
-- строки не трогаются (data-safe). Если индексы отсутствуют, а в таблице
-- успели накопиться дубли активных броней — создание упадёт loudly: это
-- признак более глубокой проблемы целостности, чинить вручную, а не
-- замалчивать (та же философия, что guard в *_review_unique_null_trip).

CREATE UNIQUE INDEX IF NOT EXISTS "active_seat_booking"
  ON "Booking"("tripId", "seat")
  WHERE "status" IN ('pending', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS "active_passenger_booking"
  ON "Booking"("tripId", "passengerId")
  WHERE "status" IN ('pending', 'confirmed');
