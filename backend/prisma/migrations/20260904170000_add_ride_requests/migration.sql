CREATE TABLE "RideRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fromCityId" TEXT NOT NULL,
  "toCityId" TEXT NOT NULL,
  "earliestAt" TIMESTAMP(3) NOT NULL,
  "latestAt" TIMESTAMP(3) NOT NULL,
  "seats" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RideRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RideRequest_status_expiresAt_idx" ON "RideRequest"("status", "expiresAt");
CREATE INDEX "RideRequest_fromCityId_toCityId_status_earliestAt_idx" ON "RideRequest"("fromCityId", "toCityId", "status", "earliestAt");
CREATE INDEX "RideRequest_userId_status_idx" ON "RideRequest"("userId", "status");
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_fromCityId_fkey" FOREIGN KEY ("fromCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RideRequest" ADD CONSTRAINT "RideRequest_toCityId_fkey" FOREIGN KEY ("toCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
