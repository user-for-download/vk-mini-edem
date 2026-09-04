-- Сжатие к MAX_SEATS = 3 (решение F1, 2026-09-04: сервер в разработке,
-- legacy-поездок нет — всё к 3 местам).
-- Зеркалит 20260806130000_normalize_legacy_seats в обратную сторону (4 → 3).

-- Активные брони на место 4 отклоняем: такого места в поездке больше не будет.
UPDATE "Booking"
SET "status" = 'declined'
WHERE "status" IN ('pending', 'confirmed')
  AND "seat" > 3
  AND "tripId" IN (SELECT "id" FROM "Trip" WHERE "seatsTotal" > 3);

-- Сжимаем число мест. seatsAvailable пересчитываем по фактическим активным
-- броням, никогда не увеличивая текущее значение (для completed/cancelled
-- поездок оно и так 0) и не опуская ниже нуля.
UPDATE "Trip"
SET
  "seatsTotal" = 3,
  "seatsAvailable" = GREATEST(
    0,
    LEAST(
      "seatsAvailable",
      3 - (
        SELECT COUNT(*)
        FROM "Booking"
        WHERE "Booking"."tripId" = "Trip"."id"
          AND "Booking"."status" IN ('pending', 'confirmed')
      )
    )
  )
WHERE "seatsTotal" > 3;

-- Страховка перед CHECK: приводим остатки вне допустимых границ
-- (только уменьшаем, никогда не увеличиваем).
UPDATE "Trip"
SET "seatsAvailable" = GREATEST(0, LEAST("seatsAvailable", "seatsTotal"))
WHERE "seatsAvailable" < 0 OR "seatsAvailable" > "seatsTotal";

-- CHECK-ограничения по решению F1 (границы совпадают с контрактами:
-- MAX_SEATS = 3, Review.rating 1..5, Trip.price > 0).
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_seatsTotal_range" CHECK ("seatsTotal" >= 1 AND "seatsTotal" <= 3);
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_seatsAvailable_nonnegative" CHECK ("seatsAvailable" >= 0);
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_price_positive" CHECK ("price" > 0);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seat_positive" CHECK ("seat" >= 1);
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" >= 1 AND "rating" <= 5);
