-- Справочник точек (городов) для автодополнения. FK nullable, чтобы
-- старые поездки (без FK) продолжали работать: снимок fromCity/toCity
-- остаётся единственным источником правды для UI/поиска/уведомлений.
--
-- nameNormalized: lower(name + trim) — для регистронезависимой
-- уникальности. Prisma не умеет в уникальный индекс с выражением,
-- поэтому уникальный индекс на nameNormalized создаётся вручную
-- (Prisma сгенерирует только City_name_idx, nameNormalized UNIQUE
-- добавляем сами).

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "fromCityId" TEXT,
ADD COLUMN     "toCityId" TEXT;

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "tripsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "City_name_idx" ON "City"("name");

-- CreateIndex (case-insensitive unique on normalized name)
CREATE UNIQUE INDEX "City_nameNormalized_key" ON "City"("nameNormalized");

-- CreateIndex
CREATE INDEX "Trip_fromCityId_idx" ON "Trip"("fromCityId");

-- CreateIndex
CREATE INDEX "Trip_toCityId_idx" ON "Trip"("toCityId");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
