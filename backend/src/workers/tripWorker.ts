import { db } from "../db.js";
import { logger } from "../logger.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// For testing locally we can make it shorter or just run on boot once?
// We can run it every hour.

export async function processExpiredTrips() {
  try {
    // Find active trips where departureAt is more than 24 hours ago
    const expiredTrips = await db.trip.findMany({
      where: {
        status: "active",
        departureAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // older than 24 hours
        },
      },
      include: {
        bookings: true,
      },
    });

    if (expiredTrips.length === 0) {
      return;
    }

    logger.info(`Found ${expiredTrips.length} expired active trips. Processing...`);

    for (const trip of expiredTrips) {
      try {
        await db.$transaction(async (tx) => {
          // 1. Mark trip as completed
          await tx.trip.update({
            where: { id: trip.id },
            data: { status: "completed" },
          });

          // 2. Decline pending bookings
          const pendingBookingIds = trip.bookings
            .filter((b) => b.status === "pending")
            .map((b) => b.id);
          
          if (pendingBookingIds.length > 0) {
            await tx.booking.updateMany({
              where: { id: { in: pendingBookingIds } },
              data: { status: "declined" },
            });
          }

          // 3. Increment driver tripsCount
          await tx.user.update({
            where: { id: trip.driverId },
            data: { tripsCount: { increment: 1 } },
          });

          // 4. Increment passengers tripsCount (only confirmed)
          const confirmedPassengerIds = trip.bookings
            .filter((b) => b.status === "confirmed")
            .map((b) => b.passengerId);

          // Passenger IDs can have duplicates if someone booked multiple seats?
          // Actually, passengerId is unique per booking? No, booking has passengerId. 
          // If a passenger books multiple seats, it's one booking or multiple?
          // The schema has `seat` in booking, so maybe multiple bookings for the same user.
          // Let's use unique passenger IDs to increment tripsCount once per passenger.
          const uniquePassengerIds = [...new Set(confirmedPassengerIds)];
          
          for (const pId of uniquePassengerIds) {
            await tx.user.update({
              where: { id: pId },
              data: { tripsCount: { increment: 1 } },
            });
          }

          logger.info(`Trip ${trip.id} auto-completed. Driver and ${uniquePassengerIds.length} passengers updated.`);
        });
      } catch (err) {
        logger.error({ err, tripId: trip.id }, "Failed to auto-complete trip");
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error in processExpiredTrips worker");
  }
}

let workerInterval: NodeJS.Timeout | null = null;

export function startTripWorker() {
  // Run once on startup
  void processExpiredTrips();
  
  workerInterval = setInterval(() => {
    void processExpiredTrips();
  }, CHECK_INTERVAL_MS);
  
  logger.info("Trip auto-completion worker started");
}

export function stopTripWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info("Trip auto-completion worker stopped");
  }
}
