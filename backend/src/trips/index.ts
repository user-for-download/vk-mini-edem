// backend/src/trips/index.ts
import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { createTripDtoSchema, TRIP_STATUS, ACTIVE_BOOKING_STATUSES } from "@edem/contracts";
import { db } from "../db.js";
import { logger } from "../logger.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { serializeTrip } from "../serializers/index.js";

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

export const tripsRouter = new Hono<AuthEnv>();

/**
 * Публичный список активных поездок.
 */
tripsRouter.get("/", async (c) => {
  const q = c.req.query("q");
  const fromCity = c.req.query("fromCity");
  const toCity = c.req.query("toCity");
  const dateFrom = c.req.query("dateFrom");
  const maxPrice = c.req.query("maxPrice");
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
  const user = c.get("user");

  const trips = await db.trip.findMany({
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
  });

  if (trips.length === 0) {
    return c.json([]);
  }

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

  return c.json(
    trips.map((trip) =>
      serializeTrip(trip, {
        bookedSeats: bookedSeatsMap.get(trip.id) ?? [],
        pendingRequestsCount: pendingCountMap.get(trip.id) ?? 0,
      })
    )
  );
});

/**
 * Детали поездки.
 * Возвращаем bookedSeats, чтобы фронт мог корректно рисовать SeatScheme.
 */
tripsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

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
    return c.json({ message: "Trip not found" }, 404);
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

  return c.json(
    serializeTrip(trip, {
      bookedSeats: activeBookings.map((booking) => booking.seat),
    })
  );
});

/**
 * Создание поездки текущим пользователем.
 */
tripsRouter.post("/", requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createTripDtoSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const dto = parseResult.data;
  const driver = c.get("user");

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

  return c.json(
    serializeTrip(created, {
      bookedSeats: [],
      pendingRequestsCount: 0,
    }),
    201
  );
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
  const user = c.get("user");

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
    return c.json({ message: "Trip not found" }, 404);
  }

  if (trip.driverId !== user.id) {
    return c.json({ message: "Forbidden" }, 403);
  }

  if (trip.status !== "active") {
    return c.json({ message: "Trip is not active" }, 400);
  }

  const updated = await db.$transaction(async (tx) => {
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

    return tx.trip.update({
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
  const user = c.get("user");
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
    return c.json({ message: "Trip not found" }, 404);
  }

  if (trip.driverId !== user.id) {
    return c.json({ message: "Forbidden" }, 403);
  }

  if (trip.status !== "active") {
    return c.json({ message: "Trip is not active" }, 400);
  }

  if (!force && trip.departureAt > new Date()) {
    return c.json({ message: "Trip has not started yet" }, 400);
  }

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

    const passengerIds = Array.from(
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

  return c.json(
    serializeTrip(updated, {
      bookedSeats: [],
      pendingRequestsCount: 0,
    })
  );
});
