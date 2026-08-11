-- CreateIndex
CREATE INDEX "Booking_tripId_seat_idx" ON "Booking"("tripId", "seat");

-- CreateIndex
CREATE INDEX "Booking_tripId_passengerId_idx" ON "Booking"("tripId", "passengerId");

-- CreateIndex
CREATE INDEX "Trip_driverId_status_departureAt_idx" ON "Trip"("driverId", "status", "departureAt" ASC);

-- RenameIndex
ALTER INDEX "unique_review_per_trip" RENAME TO "Review_authorId_tripId_targetUserId_key";
