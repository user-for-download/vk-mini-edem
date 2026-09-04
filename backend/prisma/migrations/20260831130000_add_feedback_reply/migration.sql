-- Add admin reply fields to Feedback (nullable: existing rows are "not yet answered").
-- Separate `repliedAt` index for "pending replies" admin dashboards / metrics.

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "reply" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "repliedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Feedback_repliedAt_idx" ON "Feedback"("repliedAt");
