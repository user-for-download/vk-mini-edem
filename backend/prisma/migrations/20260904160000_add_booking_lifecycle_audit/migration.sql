ALTER TABLE "Trip" ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "cancelledByType" TEXT, ADD COLUMN "cancelledByUserId" TEXT, ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN "expiresAt" TIMESTAMP(3), ADD COLUMN "cancelledAt" TIMESTAMP(3), ADD COLUMN "cancelledByType" TEXT, ADD COLUMN "cancelledByUserId" TEXT, ADD COLUMN "cancellationReason" TEXT;
CREATE INDEX "Booking_status_expiresAt_idx" ON "Booking"("status", "expiresAt");
