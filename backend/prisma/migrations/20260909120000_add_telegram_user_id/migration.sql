-- Telegram Mini Apps: идентификатор пользователя Telegram.
-- BigInt — TG user id превышает Int32; nullable (VK-легаси-пользователи
-- без Telegram), unique — точка синхронизации параллельных запусков
-- (upsert + P2002-ретрай, см. auth/vk в backend/src/auth/index.ts).
-- Postgres допускает множество NULL в unique-индексе: существующие
-- строки не конфликтуют, миграция неприменима только к данным с дублями
-- (для новой колонки невозможно).

ALTER TABLE "User" ADD COLUMN "telegramUserId" BIGINT;
CREATE UNIQUE INDEX "User_telegramUserId_key" ON "User"("telegramUserId");
