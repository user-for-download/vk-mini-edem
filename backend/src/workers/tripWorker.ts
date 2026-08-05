import { db } from "../db.js";
import { logger } from "../logger.js";
import { wsManager } from "../ws/manager.js";
import { logBusinessEvent } from "../logger/business.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export async function processExpiredTrips() {
  try {
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
          await tx.trip.update({
            where: { id: trip.id },
            data: { status: "completed", seatsAvailable: 0 },
          });

          const pendingBookingIds = trip.bookings
            .filter((b) => b.status === "pending")
            .map((b) => b.id);
          
          if (pendingBookingIds.length > 0) {
            await tx.booking.updateMany({
              where: { id: { in: pendingBookingIds } },
              data: { status: "declined" },
            });
          }

          await tx.user.update({
            where: { id: trip.driverId },
            data: { tripsCount: { increment: 1 } },
          });

          const confirmedPassengerIds = trip.bookings
            .filter((b) => b.status === "confirmed")
            .map((b) => b.passengerId);

          const uniquePassengerIds = [...new Set(confirmedPassengerIds)];
          
          for (const pId of uniquePassengerIds) {
            await tx.user.update({
              where: { id: pId },
              data: { tripsCount: { increment: 1 } },
            });
          }

          logger.info(`Trip ${trip.id} auto-completed. Driver and ${uniquePassengerIds.length} passengers updated.`);

          logBusinessEvent("trip.completed", {
            tripId: trip.id,
            driverId: trip.driverId,
            passengersCount: uniquePassengerIds.length,
          });

          for (const pId of uniquePassengerIds) {
            wsManager.sendToUser(pId, {
              type: "trip:status_changed",
              payload: { tripId: trip.id, status: "completed" },
            });
            wsManager.sendToUser(pId, {
              type: "notification:new",
              payload: { id: "refresh" },
            });
          }
          
          const declinedPassengerIds = trip.bookings
            .filter((b) => b.status === "pending")
            .map((b) => b.passengerId);
            
          const uniqueDeclinedPassengerIds = [...new Set(declinedPassengerIds)];
          
          for (const pId of uniqueDeclinedPassengerIds) {
            wsManager.sendToUser(pId, {
              type: "trip:status_changed",
              payload: { tripId: trip.id, status: "completed" },
            });
            wsManager.sendToUser(pId, {
              type: "notification:new",
              payload: { id: "refresh" },
            });
          }
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
