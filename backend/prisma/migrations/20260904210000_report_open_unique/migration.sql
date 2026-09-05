CREATE UNIQUE INDEX "Report_open_unique_idx"
  ON "Report"("reporterId", "targetType", "targetId", "category")
  WHERE "status" IN ('pending', 'in_review');
