ALTER TABLE "Review" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
UPDATE "Review" SET "status" = 'published';
CREATE INDEX "Review_targetUserId_status_idx" ON "Review"("targetUserId", "status");
