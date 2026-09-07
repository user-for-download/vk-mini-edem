-- Keep the SQL migration end state identical to schema.prisma.
CREATE INDEX IF NOT EXISTS "Booking_status_expiresAt_idx"
  ON "Booking"("status", "expiresAt");

CREATE INDEX IF NOT EXISTS "Report_reporterId_targetType_targetId_category_idx"
  ON "Report"("reporterId", "targetType", "targetId", "category");
