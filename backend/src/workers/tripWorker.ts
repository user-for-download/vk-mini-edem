import { db } from "../db.js";
import { logger } from "../logger.js";
import { wsManager } from "../ws/manager.js";
import { logBusinessEvent } from "../logger/business.js";
import { createNotification } from "../services/notification.service.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Воркер только АВТО-ЗАВЕРШАЕТ просроченные active-поездки.
 *
 * Отменённые поездки НИКОГДА не удаляем физически: CASCADE в схеме стёр бы
 * связанные брони и отзывы, и у пассажиров пропала бы история поездок
 * (экран «История»). Отменённые поездки не попадают в поиск (фильтр
 * status: "active") и не мешают работе — пусть лежат в БД.
 */
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

    if (expiredTrips.length > 0) {
      logger.info(`Found ${expiredTrips.length} expired active trips. Processing...`);
    }

    for (const trip of expiredTrips) {
      try {
        // 1. Транзакция — только изменение данных (без уведомлений, чтобы
        //    не держать соединение из пула открытым дольше необходимого).
        const { confirmedPassengerIds, declinedPassengerIds } = await db.$transaction(
          async (tx) => {
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

            const confirmedPassengerIds = [
              ...new Set(
                trip.bookings
                  .filter((b) => b.status === "confirmed")
                  .map((b) => b.passengerId)
              ),
            ];

            for (const pId of confirmedPassengerIds) {
              await tx.user.update({
                where: { id: pId },
                data: { tripsCount: { increment: 1 } },
              });
            }

            const declinedPassengerIds = [
              ...new Set(
                trip.bookings
                  .filter((b) => b.status === "pending")
                  .map((b) => b.passengerId)
              ),
            ];

            return { confirmedPassengerIds, declinedPassengerIds };
          }
        );

        logger.info(
          `Trip ${trip.id} auto-completed. Driver and ${confirmedPassengerIds.length} passengers updated.`
        );

        logBusinessEvent("trip.completed", {
          tripId: trip.id,
          driverId: trip.driverId,
          passengersCount: confirmedPassengerIds.length,
        });

        // 2. Уведомления и WS — ВНЕ транзакции (паттерн как в ручном
        //    завершении/отмене): персистентные записи + события онлайн-клиентам.
        //    createNotification глотает ошибки внутри, поэтому параллелим безопасно.
        await Promise.all(
          confirmedPassengerIds.map(async (pId) => {
            await createNotification(
              pId,
              "trip_status_changed",
              "Поездка завершена",
              `Поездка ${trip.fromCity} → ${trip.toCity} завершена. Вы можете оставить отзыв.`
            );
            wsManager.sendToUser(pId, {
              type: "trip:status_changed",
              payload: { tripId: trip.id, status: "completed" },
            });
            wsManager.sendToUser(pId, {
              type: "notification:new",
              payload: { id: "refresh" },
            });
          })
        );

        await Promise.all(
          declinedPassengerIds.map(async (pId) => {
            await createNotification(
              pId,
              "trip_status_changed",
              "Поездка завершена",
              `Поездка ${trip.fromCity} → ${trip.toCity} завершена, ваша заявка отклонена.`
            );
            wsManager.sendToUser(pId, {
              type: "trip:status_changed",
              payload: { tripId: trip.id, status: "completed" },
            });
            wsManager.sendToUser(pId, {
              type: "notification:new",
              payload: { id: "refresh" },
            });
          })
        );

        // Водителя тоже уведомляем о завершении.
        await createNotification(
          trip.driverId,
          "trip_status_changed",
          "Поездка завершена",
          `Ваша поездка ${trip.fromCity} → ${trip.toCity} автоматически завершена.`
        );
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
