// backend/src/trips/index.ts
import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { createTripDtoSchema, updateTripDtoSchema, TRIP_STATUS, ACTIVE_BOOKING_STATUSES } from "@edem/contracts";
import { db } from "../db.js";
import { logger } from "../logger.js";
import { requireUser, type AuthUser } from "../auth/middleware.js";
import { optionalAuth } from "../auth/optionalMiddleware.js";
import { serializeTrip } from "../serializers/index.js";
import { publicReadLimiter, mutationLimiter } from "../middleware/rateLimit.js";
import { getSanitizedBody } from "../middleware/sanitize.js";
import { ERROR_CODES } from "../errors.js";
import { logBusinessEvent } from "../logger/business.js";
import { createNotification } from "../services/notification.service.js";
import { wsManager } from "../ws/manager.js";

async function getActiveBookingSeatsByTripIds(
  tripIds: string[]
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();

  if (tripIds.length === 0) {
    return map;
  }

  const bookings = await db.booking.findMany({
    where: {
      tripId: {
        in: tripIds,
      },
      status: {
        in: [...ACTIVE_BOOKING_STATUSES],
      },
    },
    select: {
      tripId: true,
      seat: true,
    },
  });

  for (const booking of bookings) {
    const seats = map.get(booking.tripId) ?? [];
    seats.push(booking.seat);
    map.set(booking.tripId, seats);
  }

  return map;
}

export const tripsRouter = new Hono<{ Variables: { user?: AuthUser } }>();

/**
 * Публичный список активных поездок.
 */
tripsRouter.get("/", publicReadLimiter, async (c) => {
  const q = c.req.query("q");
  const fromCity = c.req.query("fromCity");
  const toCity = c.req.query("toCity");
  const dateFrom = c.req.query("dateFrom");
  const dateTo = c.req.query("dateTo");
  const maxPrice = c.req.query("maxPrice");
  const tagsParam = c.req.query("tags");
  const pageParam = c.req.query("page");
  const limitParam = c.req.query("limit");

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(limitParam ?? "20", 10) || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.TripWhereInput = {
    status: "active",
  };

  if (q) {
    where.OR = [
      { fromCity: { contains: q, mode: "insensitive" } },
      { toCity: { contains: q, mode: "insensitive" } },
      { fromAddress: { contains: q, mode: "insensitive" } },
      { toAddress: { contains: q, mode: "insensitive" } },
    ];
  }

  if (fromCity) {
    where.fromCity = { contains: fromCity, mode: "insensitive" };
  }

  if (toCity) {
    where.toCity = { contains: toCity, mode: "insensitive" };
  }

  if (dateFrom) {
    const parsedDate = new Date(dateFrom);
    if (!Number.isNaN(parsedDate.getTime())) {
      where.departureAt = {
        ...(where.departureAt as object),
        gte: parsedDate,
      };
    }
  }

  if (dateTo) {
    const parsedDateTo = new Date(dateTo);
    if (!Number.isNaN(parsedDateTo.getTime())) {
      parsedDateTo.setHours(23, 59, 59, 999);
      where.departureAt = {
        ...(where.departureAt as object),
        lte: parsedDateTo,
      };
    }
  }

  if (tagsParam) {
    const tags = tagsParam.split(",").filter(Boolean);
    if (tags.length > 0) {
      where.tags = { hasEvery: tags };
    }
  }

  if (maxPrice) {
    const parsedMaxPrice = Number.parseInt(maxPrice, 10);

    if (Number.isNaN(parsedMaxPrice)) {
      return c.json({ message: "Invalid maxPrice" }, 400);
    }

    where.price = { lte: parsedMaxPrice };
  }

  const [trips, total] = await Promise.all([
    db.trip.findMany({
      where,
      include: {
        driver: {
          include: {
            car: true,
          },
        },
      },
      orderBy: {
        departureAt: "asc",
      },
      skip,
      take: limit,
    }),
    db.trip.count({ where }),
  ]);

  const bookedSeatsMap = await getActiveBookingSeatsByTripIds(
    trips.map((trip) => trip.id)
  );

  return c.json({
    items: trips.map((trip) =>
      serializeTrip(trip, {
        bookedSeats: bookedSeatsMap.get(trip.id) ?? [],
      })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
});

/**
 * Поездки текущего пользователя как водителя.
 * Важно: маршрут должен быть объявлен до /:id.
 */
tripsRouter.get("/my", requireUser, async (c) => {
  const user = c.get("user")!;
  const pageParam = c.req.query("page");
  const limitParam = c.req.query("limit");
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(limitParam ?? "20", 10) || 20));
  const skip = (page - 1) * limit;

  const [trips, total] = await Promise.all([
    db.trip.findMany({
      where: {
        driverId: user.id,
      },
      include: {
        driver: {
          include: {
            car: true,
          },
        },
      },
      orderBy: {
        departureAt: "desc",
      },
      skip,
      take: limit,
    }),
    db.trip.count({ where: { driverId: user.id } }),
  ]);

  const tripIds = trips.map((trip) => trip.id);

  const bookings = await db.booking.findMany({
    where: {
      tripId: {
        in: tripIds,
      },
    },
    select: {
      tripId: true,
      seat: true,
      status: true,
    },
  });

  const bookedSeatsMap = new Map<string, number[]>();
  const pendingCountMap = new Map<string, number>();

  for (const booking of bookings) {
    if (booking.status === "pending") {
      pendingCountMap.set(
        booking.tripId,
        (pendingCountMap.get(booking.tripId) ?? 0) + 1
      );
    }

    if (booking.status === "pending" || booking.status === "confirmed") {
      const seats = bookedSeatsMap.get(booking.tripId) ?? [];
      seats.push(booking.seat);
      bookedSeatsMap.set(booking.tripId, seats);
    }
  }

  return c.json({
    items: trips.map((trip) =>
      serializeTrip(trip, {
        bookedSeats: bookedSeatsMap.get(trip.id) ?? [],
        pendingRequestsCount: pendingCountMap.get(trip.id) ?? 0,
      })
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    },
  });
});

/**
 * Детали поездки.
 * Возвращаем bookedSeats, чтобы фронт мог корректно рисовать SeatScheme.
 */
tripsRouter.get("/:id", publicReadLimiter, optionalAuth, async (c) => {
  const id = c.req.param("id");
  const currentUser = c.get("user");

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      driver: {
        include: {
          car: true,
        },
      },
    },
  });

  if (!trip) {
    return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Trip not found" }, 404);
  }

  const activeBookings = await db.booking.findMany({
    where: {
      tripId: trip.id,
      status: {
        in: ["pending", "confirmed"],
      },
    },
    select: {
      seat: true,
    },
  });

  let myBooking: {
    id: string;
    seat: number;
    status: string;
    createdAt: Date;
  } | null = null;

  if (currentUser) {
    const booking = await db.booking.findFirst({
      where: {
        tripId: trip.id,
        passengerId: currentUser.id,
        status: { in: ["pending", "confirmed"] },
      },
      select: {
        id: true,
        seat: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    myBooking = booking;
  }

  return c.json(
    serializeTrip(trip, {
      bookedSeats: activeBookings.map((booking) => booking.seat),
      myBooking,
    })
  );
});

/**
 * Создание поездки текущим пользователем.
 */
tripsRouter.post("/", requireUser, mutationLimiter, async (c) => {
  const body = await getSanitizedBody(c);
  const parseResult = createTripDtoSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const dto = parseResult.data;
  const driver = c.get("user")!;

  // Водитель должен иметь автомобиль
  if (!driver.car) {
    return c.json(
      { code: ERROR_CODES.NO_CAR, message: "You must add a car before creating a trip" },
      400
    );
  }

  // Валидация: поездка не может быть в прошлом
  const departureDate = new Date(dto.departureAt);
  if (departureDate <= new Date()) {
    return c.json(
      { code: ERROR_CODES.TRIP_IN_PAST, message: "Departure time must be in the future" },
      400
    );
  }

  const created = await db.trip.create({
    data: {
      driverId: driver.id,
      fromCity: dto.fromCity,
      fromAddress: dto.fromAddress,
      toCity: dto.toCity,
      toAddress: dto.toAddress,
      departureAt: new Date(dto.departureAt),
      durationMinutes: dto.durationMinutes,
      distanceKm: dto.distanceKm,
      price: dto.price,
      seatsTotal: dto.seatsTotal,
      seatsAvailable: dto.seatsTotal,
      tags: dto.tags,
      comment: dto.comment,
    },
    include: {
      driver: {
        include: {
          car: true,
        },
      },
    },
  });

  logBusinessEvent("trip.created", {
    tripId: created.id,
    driverId: driver.id,
    fromCity: dto.fromCity,
    toCity: dto.toCity,
  });

  return c.json(
    serializeTrip(created, {
      bookedSeats: [],
      pendingRequestsCount: 0,
    }),
    201
  );
});

tripsRouter.patch("/:id", requireUser, mutationLimiter, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const body = await getSanitizedBody(c);
  
  const parseResult = updateTripDtoSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ message: "Invalid payload", errors: parseResult.error.format() }, 400);
  }

  const dto = parseResult.data;
  const trip = await db.trip.findUnique({ where: { id } });

  if (!trip) return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Trip not found" }, 404);
  if (trip.driverId !== user.id) return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Forbidden" }, 403);
  if (trip.status !== "active") return c.json({ code: ERROR_CODES.TRIP_NOT_ACTIVE, message: "Trip is not active" }, 400);

  if (dto.departureAt) {
    const newDepartureAt = new Date(dto.departureAt);
    if (newDepartureAt <= new Date()) {
      return c.json({ code: ERROR_CODES.TRIP_IN_PAST, message: "Departure time must be in the future" }, 400);
    }
  }

  if (dto.seatsTotal !== undefined) {
    const activeBookingsCount = await db.booking.count({
      where: { tripId: trip.id, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
    });
    if (dto.seatsTotal < activeBookingsCount) {
      return c.json({ message: `Cannot reduce seats below ${activeBookingsCount}` }, 400);
    }
  }

  const updateData: Record<string, unknown> = {};
  if (dto.fromCity !== undefined) updateData.fromCity = dto.fromCity;
  if (dto.fromAddress !== undefined) updateData.fromAddress = dto.fromAddress;
  if (dto.toCity !== undefined) updateData.toCity = dto.toCity;
  if (dto.toAddress !== undefined) updateData.toAddress = dto.toAddress;
  if (dto.departureAt !== undefined) updateData.departureAt = new Date(dto.departureAt);
  if (dto.durationMinutes !== undefined) updateData.durationMinutes = dto.durationMinutes;
  if (dto.distanceKm !== undefined) updateData.distanceKm = dto.distanceKm;
  if (dto.price !== undefined) updateData.price = dto.price;
  if (dto.tags !== undefined) updateData.tags = dto.tags;
  if (dto.comment !== undefined) updateData.comment = dto.comment;

  if (dto.seatsTotal !== undefined) {
    const seatsDiff = dto.seatsTotal - trip.seatsTotal;
    updateData.seatsTotal = dto.seatsTotal;
    updateData.seatsAvailable = Math.max(0, trip.seatsAvailable + seatsDiff);
  }

  const updated = await db.trip.update({
    where: { id },
    data: updateData,
    include: { driver: { include: { car: true } } },
  });

  /**
   * Если изменились важные для пассажиров поля — уведомляем подтверждённых пассажиров
   * (персистентное уведомление + WS-событие для онлайн-клиентов).
   */
  const importantFieldsChanged =
    (dto.departureAt !== undefined &&
      trip.departureAt.toISOString() !== updated.departureAt.toISOString()) ||
    (dto.fromCity !== undefined && trip.fromCity !== updated.fromCity) ||
    (dto.toCity !== undefined && trip.toCity !== updated.toCity) ||
    (dto.fromAddress !== undefined && trip.fromAddress !== updated.fromAddress) ||
    (dto.toAddress !== undefined && trip.toAddress !== updated.toAddress) ||
    (dto.price !== undefined && trip.price !== updated.price);

  if (importantFieldsChanged) {
    const confirmedBookings = await db.booking.findMany({
      where: { tripId: trip.id, status: "confirmed" },
      select: { passengerId: true },
    });

    // createNotification глотает ошибки внутри, поэтому параллелим безопасно.
    await Promise.all(
      confirmedBookings.map(async (booking) => {
        await createNotification(
          booking.passengerId,
          "trip_details_changed",
          "Детали поездки изменены",
          `Водитель изменил детали поездки ${updated.fromCity} → ${updated.toCity}. Проверьте время и место встречи.`
        );

        wsManager.sendToUser(booking.passengerId, {
          type: "trip:details_changed",
          payload: { tripId: trip.id },
        });
        // Подсказываем онлайн-клиенту обновить список/счётчик уведомлений.
        wsManager.sendToUser(booking.passengerId, {
          type: "notification:new",
          payload: { id: "refresh" },
        });
      })
    );
  }

  return c.json(serializeTrip(updated));
});

/**
 * Отмена поездки водителем.
 *
 * Логика:
 * - отменить может только водитель поездки;
 * - отменить можно только active поездку;
 * - все pending/confirmed брони становятся declined;
 * - seatsAvailable обнуляется, так как поездка больше не доступна для бронирования.
 */
tripsRouter.patch("/:id/cancel", requireUser, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      driver: {
        include: {
          car: true,
        },
      },
    },
  });

  if (!trip) {
    return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Trip not found" }, 404);
  }

  if (trip.driverId !== user.id) {
    return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Forbidden" }, 403);
  }

  if (trip.status !== "active") {
    return c.json({ code: ERROR_CODES.TRIP_NOT_ACTIVE, message: "Trip is not active" }, 400);
  }

  const { updated, uniquePassengers } = await db.$transaction(async (tx) => {
    // Пассажиров собираем ДО updateMany: после перевода броней в cancelled
    // выборка по pending/confirmed вернёт пустой массив.
    const activeBookings = await tx.booking.findMany({
      where: { tripId: trip.id, status: { in: ["pending", "confirmed"] } },
      select: { passengerId: true },
    });

    await tx.booking.updateMany({
      where: {
        tripId: trip.id,
        status: {
          in: ["pending", "confirmed"],
        },
      },
      data: {
        status: "cancelled",
      },
    });

    const updated = await tx.trip.update({
      where: { id: trip.id },
      data: {
        status: "cancelled",
        seatsAvailable: 0,
      },
      include: {
        driver: {
          include: {
            car: true,
          },
        },
      },
    });

    return {
      updated,
      uniquePassengers: Array.from(new Set(activeBookings.map((b) => b.passengerId))),
    };
  });

  // createNotification глотает ошибки внутри, поэтому параллелим безопасно.
  await Promise.all(
    uniquePassengers.map(async (pid) => {
      await createNotification(
        pid,
        "trip_cancelled",
        "Поездка отменена",
        `Водитель отменил поездку ${trip.fromCity} → ${trip.toCity}`
      );

      wsManager.sendToUser(pid, {
        type: "trip:status_changed",
        payload: { tripId: trip.id, status: "cancelled" },
      });
      wsManager.sendToUser(pid, {
        type: "notification:new",
        payload: { id: "refresh" },
      });
    })
  );

  logBusinessEvent("trip.cancelled", {
    tripId: trip.id,
    driverId: user.id,
  });

  return c.json(
    serializeTrip(updated, {
      bookedSeats: [],
      pendingRequestsCount: 0,
    })
  );
});

/**
 * Завершение поездки водителем.
 *
 * Правила:
 * - завершить может только водитель поездки;
 * - поездка должна быть active;
 * - по умолчанию завершить можно только поездку, которая уже началась;
 * - force=1 позволяет завершить поездку раньше (полезно для dev/тестирования);
 * - pending-заявки отклоняются;
 * - confirmed-заявки остаются как история.
 */
tripsRouter.patch("/:id/complete", requireUser, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user")!;
  const force = c.req.query("force") === "1";

  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      driver: {
        include: {
          car: true,
        },
      },
    },
  });

  if (!trip) {
    return c.json({ code: ERROR_CODES.NOT_FOUND, message: "Trip not found" }, 404);
  }

  if (trip.driverId !== user.id) {
    return c.json({ code: ERROR_CODES.FORBIDDEN, message: "Forbidden" }, 403);
  }

  if (trip.status !== "active") {
    return c.json({ code: ERROR_CODES.TRIP_NOT_ACTIVE, message: "Trip is not active" }, 400);
  }

  if (!force && trip.departureAt > new Date()) {
    return c.json({ code: ERROR_CODES.TRIP_IN_PAST, message: "Trip has not started yet" }, 400);
  }

  let passengerIds: string[] = [];

  const updated = await db.$transaction(async (tx) => {
    // 1. Decline all pending bookings
    await tx.booking.updateMany({
      where: {
        tripId: trip.id,
        status: "pending",
      },
      data: {
        status: "declined",
      },
    });

    // 2. Find confirmed passengers
    const confirmedBookings = await tx.booking.findMany({
      where: {
        tripId: trip.id,
        status: "confirmed",
      },
      select: {
        passengerId: true,
      },
    });

    passengerIds = Array.from(
      new Set(confirmedBookings.map((booking) => booking.passengerId))
    );

    // 3. Driver +1 tripsCount
    await tx.user.update({
      where: { id: trip.driverId },
      data: {
        tripsCount: {
          increment: 1,
        },
      },
    });

    // 4. Each confirmed passenger +1 tripsCount
    for (const passengerId of passengerIds) {
      await tx.user.update({
        where: { id: passengerId },
        data: {
          tripsCount: {
            increment: 1,
          },
        },
      });
    }

    // 5. Update trip status
    return tx.trip.update({
      where: { id: trip.id },
      data: {
        status: "completed",
        seatsAvailable: 0,
      },
      include: {
        driver: {
          include: {
            car: true,
          },
        },
      },
    });
  });

  logBusinessEvent("trip.completed", {
    tripId: trip.id,
    driverId: user.id,
    passengersCount: passengerIds.length,
  });

  for (const pid of passengerIds) {
    wsManager.sendToUser(pid, {
      type: "trip:status_changed",
      payload: { tripId: trip.id, status: "completed" },
    });
    wsManager.sendToUser(pid, {
      type: "notification:new",
      payload: { id: "refresh" },
    });
  }

  return c.json(
    serializeTrip(updated, {
      bookedSeats: [],
      pendingRequestsCount: 0,
    })
  );
});
