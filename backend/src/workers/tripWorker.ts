import { Prisma } from "@prisma/client";
import { db } from "../db.js";
import { logger } from "../logger.js";
import { wsManager } from "../ws/manager.js";
import { logBusinessEvent } from "../logger/business.js";
import { createNotification } from "../services/notification.service.js";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const TRIP_WORKER_BATCH_SIZE = 100;

interface ExpiredTrip {
  id: string;
  driverId: string;
  fromCity: string;
  toCity: string;
}

/**
 * Воркер только АВТО-ЗАВЕРШАЕТ просроченные active-поездки.
 *
 * Отменённые поездки НИКОГДА не удаляем физически: CASCADE в схеме стёр бы
 * связанные брони и отзывы, и у пассажиров пропала бы история поездок
 * (экран «История»). Отменённые поездки не попадают в поиск (фильтр
 * status: "active") и не мешают работе — пусть лежат в БД.
 *
 * Память: вместо include bookings грузим только ключевые поля поездок
 * пачками (keyset pagination по id), а брони перечитываем точечно внутри
 * транзакции каждой поездки.
 */
export async function processExpiredTrips() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let processedCount = 0;
  let lastId: string | null = null;

  try {
    while (true) {
      const expiredTrips: ExpiredTrip[] = await db.trip.findMany({
        where: {
          status: "active",
          departureAt: { lt: cutoff },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        // select вместо include — брони не грузим здесь, только ключ и данные для уведомлений
        select: { id: true, driverId: true, fromCity: true, toCity: true },
        orderBy: { id: "asc" },
        take: TRIP_WORKER_BATCH_SIZE,
      });

      if (expiredTrips.length === 0) break;

      logger.info({ firstBatchSize: expiredTrips.length, cutoff }, "trip_worker_found_expired");

      for (const trip of expiredTrips) {
        await processExpiredTrip(trip);
        processedCount++;
      }

      if (expiredTrips.length < TRIP_WORKER_BATCH_SIZE) break;
      lastId = expiredTrips[expiredTrips.length - 1].id;
    }

    if (processedCount > 0) {
      logger.info({ processedCount }, "trip_worker_batch_complete");
    }
  } catch (err) {
    logger.error({ err }, "trip_worker_fatal_error");
  }
}

async function processExpiredTrip(trip: ExpiredTrip) {
  try {
    // Транзакция — только изменение данных (без уведомлений, чтобы
    // не держать соединение из пула открытым дольше необходимого).
    const { confirmedPassengerIds, declinedPassengerIds } = await db.$transaction(
      async (tx) => {
        await tx.trip.update({
          where: { id: trip.id },
          data: { status: "completed", seatsAvailable: 0 },
        });

        // Перечитываем брони ВНУТРИ транзакции: в batch-запросе
        // processExpiredTrips брони не грузятся, а бронь, созданная в
        // промежутке, иначе осталась бы в статусе pending на завершённой
        // поездке навсегда. Грузим только нужные поля.
        const txBookings = await tx.booking.findMany({
          where: { tripId: trip.id },
          select: { id: true, status: true, passengerId: true },
        });

        const pendingBookingIds = txBookings
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
            txBookings
              .filter((b) => b.status === "confirmed")
              .map((b) => b.passengerId)
          ),
        ];

        // Один батч-апдейт вместо N отдельных user.update — меньше
        // round-trip'ов и памяти на поездках с большим числом пассажиров.
        if (confirmedPassengerIds.length > 0) {
          await tx.$executeRaw`
            UPDATE "User" SET "tripsCount" = "tripsCount" + 1
            WHERE id IN (${Prisma.join(confirmedPassengerIds)})
          `;
        }

        const declinedPassengerIds = [
          ...new Set(
            txBookings
              .filter((b) => b.status === "pending")
              .map((b) => b.passengerId)
          ),
        ];

        return { confirmedPassengerIds, declinedPassengerIds };
      },
      { isolationLevel: "Serializable" }
    );

    logBusinessEvent("trip.completed", {
      tripId: trip.id,
      driverId: trip.driverId,
      passengersCount: confirmedPassengerIds.length,
    });

    // Уведомления и WS — ВНЕ транзакции (паттерн как в ручном
    // завершении/отмене): персистентные записи + события онлайн-клиентам.
    // Promise.allSettled: отказ одного уведомления не пропускает остальные,
    // необработанных rejections не остаётся.
    const sideEffects: Array<Promise<unknown> | number> = [
      ...confirmedPassengerIds.flatMap((pId) => [
        createNotification(
          pId,
          "trip_status_changed",
          "Поездка завершена",
          `Поездка ${trip.fromCity} → ${trip.toCity} завершена. Вы можете оставить отзыв.`
        ),
        wsManager.sendToUser(pId, {
          type: "trip:status_changed",
          payload: { tripId: trip.id, status: "completed" },
        }),
        wsManager.sendToUser(pId, {
          type: "notification:new",
          payload: { id: "refresh" },
        }),
      ]),
      ...declinedPassengerIds.flatMap((pId) => [
        createNotification(
          pId,
          "trip_status_changed",
          "Поездка завершена",
          `Поездка ${trip.fromCity} → ${trip.toCity} завершена, ваша заявка отклонена.`
        ),
        wsManager.sendToUser(pId, {
          type: "trip:status_changed",
          payload: { tripId: trip.id, status: "completed" },
        }),
        wsManager.sendToUser(pId, {
          type: "notification:new",
          payload: { id: "refresh" },
        }),
      ]),
      // Водителя тоже уведомляем о завершении.
      createNotification(
        trip.driverId,
        "trip_status_changed",
        "Поездка завершена",
        `Ваша поездка ${trip.fromCity} → ${trip.toCity} автоматически завершена.`
      ),
      wsManager.sendToUser(trip.driverId, {
        type: "trip:status_changed",
        payload: { tripId: trip.id, status: "completed" },
      }),
      wsManager.sendToUser(trip.driverId, {
        type: "notification:new",
        payload: { id: "refresh" },
      }),
    ];

    const results = await Promise.allSettled(sideEffects);
    for (const result of results) {
      if (result.status === "rejected") {
        logger.error({ tripId: trip.id, err: result.reason }, "trip_worker_notify_failed");
      }
    }
  } catch (err) {
    logger.error({ err, tripId: trip.id }, "trip_worker_trip_failed");
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
