-- F17: City.tripsCount не должен уходить в минус.
--
-- Счётчик меняется только через cities/counters.ts: инкремент при создании
-- поездки, guarded-декремент при отмене (updateMany WHERE tripsCount > 0)
-- и полный пересчёт (POST /admin/cities/recompute-trips-count). DB CHECK —
-- последняя линия обороны: прямые SQL-обновления (консоль, скрипты) тоже не
-- могут опустить счётчик ниже нуля.
--
-- Data-safe: сначала приводим возможные отрицательные остатки к 0, затем
-- добавляем ограничение (тот же паттерн, что *_compress_seats_to_max3).

UPDATE "City"
SET "tripsCount" = 0
WHERE "tripsCount" < 0;

ALTER TABLE "City" ADD CONSTRAINT "City_tripsCount_nonnegative" CHECK ("tripsCount" >= 0);
