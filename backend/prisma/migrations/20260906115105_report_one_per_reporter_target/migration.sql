-- Одна жалоба навсегда на связку (автор, объект).
-- Заменяет частичный индекс Report_open_unique_idx (только открытые + разбивка
-- по категориям позволяла слать несколько жалоб на 1 объект): категория и статус
-- из ключа убраны, повтор невозможен даже после рассмотрения.
DROP INDEX IF EXISTS "Report_open_unique_idx";

-- Имя в каноническом формате Prisma для @@unique([reporterId, targetType, targetId]).
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key"
  ON "Report"("reporterId", "targetType", "targetId");
