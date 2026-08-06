-- CreateIndex
CREATE UNIQUE INDEX "unique_review_per_trip" ON "Review"("authorId", "tripId", "targetUserId");
