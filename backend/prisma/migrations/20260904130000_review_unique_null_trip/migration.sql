-- F14: NULL-safety уникального ограничения Review.
--
-- В PostgreSQL в unique-индексе NULL считается «различным» со всеми
-- остальными значениями: существующий индекс
-- Review_authorId_tripId_targetUserId_key НЕ предотвращает дубли
-- (authorId, targetUserId), когда tripId IS NULL. Такие строки легальны
-- по схеме: legacy-отзывы и отзывы поездок, удалённых позже
-- (FK onDelete: SetNull обнуляет tripId).
--
-- Заменяем дыру partial-unique-индексом: для строк с tripId IS NULL пара
-- (authorId, targetUserId) уникальна. В связке с существующим полным
-- индексом (строки с tripId NOT NULL) это даёт полную уникальность
-- (authorId, tripId, targetUserId).
--
-- Data-safe: миграция НЕ трогает и не изменяет строки (no data loss).
-- Если в таблице уже есть дубли (authorId, targetUserId) с tripId IS NULL,
-- создать индекс без потери данных невозможно — guard ниже падает
-- миграцию с явным сообщением вместо молчаливого решения проблемы.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Review"
    WHERE "tripId" IS NULL
    GROUP BY "authorId", "targetUserId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'F14: duplicate Review rows with NULL tripId for the same (authorId, targetUserId) exist; dedupe them before applying this migration';
  END IF;
END
$$;

CREATE UNIQUE INDEX "Review_authorId_targetUserId_nullTrip_key"
  ON "Review"("authorId", "targetUserId")
  WHERE "tripId" IS NULL;
