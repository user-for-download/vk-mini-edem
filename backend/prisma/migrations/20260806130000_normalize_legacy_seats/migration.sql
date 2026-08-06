-- Приведение legacy-поездок к MAX_SEATS = 4.
-- Старые схемы допускали seatsTotal до 8; новые формы и DTO (max 4) делали
-- такие поездки нередактируемыми и невалидными на чтении.

-- Pending-брони на места > 4 отклоняем: таких мест в поездке больше не будет.
UPDATE "Booking"
SET "status" = 'declined'
WHERE "status" = 'pending'
  AND "seat" > 4
  AND "tripId" IN (SELECT "id" FROM "Trip" WHERE "seatsTotal" > 4);

-- Сжимаем число мест. seatsAvailable пересчитываем по фактическим активным
-- броням, никогда не увеличивая текущее значение (для completed/cancelled
-- поездок оно и так 0) и не опуская ниже нуля.
UPDATE "Trip"
SET
  "seatsTotal" = 4,
  "seatsAvailable" = GREATEST(
    0,
    LEAST(
      "seatsAvailable",
      4 - (
        SELECT COUNT(*)
        FROM "Booking"
        WHERE "Booking"."tripId" = "Trip"."id"
          AND "Booking"."status" IN ('pending', 'confirmed')
      )
    )
  )
WHERE "seatsTotal" > 4;
