import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import {
  createBookingDtoSchema,
  updateBookingStatusDtoSchema,
  TRIP_STATUS,
  BOOKING_STATUS,
  ACTIVE_BOOKING_STATUSES,
  isActiveBookingStatus,
} from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { logger } from "../logger.js";
import { serializeBooking } from "../serializers/index.js";

type HttpStatus = 400 | 403 | 404 | 409;

class BookingError extends Error {
  status: HttpStatus;

  constructor(message: string, status: HttpStatus = 400) {
    super(message);
    this.status = status;
  }
}

export const bookingsRouter = new Hono<AuthEnv>();

bookingsRouter.use("*", requireUser);

/**
 * Брони текущего пользователя как пассажира.
 *
 * Возвращает не просто брони, а enriched-объекты:
 * - scope: active | history;
 * - canReview: можно ли оставить отзыв;
 * - hasReview: оставлен ли отзыв;
 * - trip.departureAt: ISO-дата для сортировки;
 * - trip.status: статус поездки.
 */
bookingsRouter.get("/my", async (c) => {
  const user = c.get("user");

  const bookings = await db.booking.findMany({
    where: {
      passengerId: user.id,
    },
    include: {
      trip: {
        include: {
          driver: { include: { car: true } },
        },
      },
      passenger: { include: { car: true } },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (bookings.length === 0) {
    return c.json([]);
  }

  const tripIds = bookings.map((booking) => booking.tripId);

  const reviews = await db.review.findMany({
    where: {
      authorId: user.id,
      tripId: {
        in: tripIds,
      },
    },
    select: {
      tripId: true,
    },
  });

  const reviewedTripIds = new Set(
    reviews
      .map((review) => review.tripId)
      .filter((tripId): tripId is string => Boolean(tripId))
  );

  const now = new Date();

  const formatted = bookings.map((b) => {
    const isTripCompleted =
      b.trip.status === "completed" || b.trip.departureAt <= now;

    const isActive =
      (b.status === "pending" || b.status === "confirmed") &&
      b.trip.status === "active" &&
      !isTripCompleted;

    const hasReview = reviewedTripIds.has(b.tripId);

    const canReview =
      b.status === "confirmed" &&
      b.trip.status !== "cancelled" &&
      isTripCompleted &&
      !hasReview;

    return {
      id: b.id,
      seat: b.seat,
      status: b.status as "pending" | "confirmed" | "declined",
      comment: b.comment || undefined,

      /**
       * Поля для клиентской логики истории и отзывов.
       */
      scope: isActive ? "active" : "history",
      canReview,
      hasReview,

      passenger: {
        id: b.passenger.id,
        name: b.passenger.name,
        avatar: b.passenger.avatar,
        rating: b.passenger.rating,
        reviewsCount: b.passenger.reviewsCount,
        tripsCount: b.passenger.tripsCount,
      },

      trip: {
        id: b.trip.id,
        fromCity: b.trip.fromCity,
        fromAddress: b.trip.fromAddress,
        toCity: b.trip.toCity,
        toAddress: b.trip.toAddress,
        date: new Date(b.trip.departureAt).toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "short",
        }),
        time: new Date(b.trip.departureAt).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        durationMinutes: b.trip.durationMinutes,
        distanceKm: b.trip.distanceKm,
        price: b.trip.price,
        seatsTotal: b.trip.seatsTotal,
        seatsAvailable: b.trip.seatsAvailable,

        /**
         * Служебные поля для frontend.
         */
        status: b.trip.status as "active" | "cancelled" | "completed",
        departureAt: b.trip.departureAt.toISOString(),

        driver: {
          id: b.trip.driver.id,
          name: b.trip.driver.name,
          avatar: b.trip.driver.avatar,
          rating: b.trip.driver.rating,
          reviewsCount: b.trip.driver.reviewsCount,
          tripsCount: b.trip.driver.tripsCount,
          isVerified: b.trip.driver.isVerified,
          car: b.trip.driver.car
            ? {
                model: b.trip.driver.car.model,
                color: b.trip.driver.car.color,
                plate: b.trip.driver.car.plate,
              }
            : undefined,
        },

        tags: (() => {
          try {
            return typeof b.trip.tags === 'string' ? JSON.parse(b.trip.tags) : (b.trip.tags || []);
          } catch {
            return [];
          }
        })(),
        comment: b.trip.comment || undefined,
      },
    };
  });

  return c.json(formatted);
});

/**
 * История поездок текущего пользователя как пассажира.
 *
 * Возвращает брони, которые уже не являются активными:
 * - поездка прошла по времени;
 * - поездка завершена/отменена;
 * - бронь была отклонена.
 */
bookingsRouter.get("/history", async (c) => {
  const user = c.get("user");

  const bookings = await db.booking.findMany({
    where: {
      passengerId: user.id,
    },
    include: {
      trip: {
        include: {
          driver: {
            include: {
              car: true,
            },
          },
        },
      },
      passenger: {
        include: {
          car: true,
        },
      },
    },
  });

  const now = new Date();

  const history = bookings.filter((booking) => {
    const tripIsPast = booking.trip.departureAt <= now;
    const tripIsNotActive = booking.trip.status !== "active";
    const bookingIsDeclined = booking.status === "declined";

    return tripIsPast || tripIsNotActive || bookingIsDeclined;
  });

  history.sort(
    (a, b) =>
      b.trip.departureAt.getTime() - a.trip.departureAt.getTime()
  );

  if (history.length === 0) {
    return c.json([]);
  }

  const tripIds = Array.from(new Set(history.map((b) => b.tripId)));

  const reviews = await db.review.findMany({
    where: {
      authorId: user.id,
      tripId: {
        in: tripIds,
      },
    },
    select: {
      tripId: true,
    },
  });

  const reviewedTripIds = new Set(
    reviews
      .map((review) => review.tripId)
      .filter((tripId): tripId is string => Boolean(tripId))
  );

  const formatted = history.map((b) => {
    const tripIsCompleted =
      b.trip.status === "completed" || b.trip.departureAt <= now;

    const hasReview = reviewedTripIds.has(b.tripId);

    const canReview =
      b.status === "confirmed" &&
      b.trip.status !== "cancelled" &&
      tripIsCompleted &&
      !hasReview;

    return {
      id: b.id,
      seat: b.seat,
      status: b.status as "pending" | "confirmed" | "declined",
      comment: b.comment || undefined,

      canReview,
      hasReview,

      passenger: serializeUser(b.passenger),

    trip: {
      id: b.trip.id,
      fromCity: b.trip.fromCity,
      fromAddress: b.trip.fromAddress,
      toCity: b.trip.toCity,
      toAddress: b.trip.toAddress,

      date: new Date(b.trip.departureAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        weekday: "short",
      }),
      time: new Date(b.trip.departureAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),

      durationMinutes: b.trip.durationMinutes,
      distanceKm: b.trip.distanceKm,
      price: b.trip.price,
      seatsTotal: b.trip.seatsTotal,
      seatsAvailable: b.trip.seatsAvailable,

      status: b.trip.status as "active" | "cancelled" | "completed",
      departureAt: b.trip.departureAt.toISOString(),

      driver: serializeUser(b.trip.driver),

      tags: (() => {
        try {
          return typeof b.trip.tags === 'string' ? JSON.parse(b.trip.tags) : (b.trip.tags || []);
        } catch {
          return [];
        }
      })(),
      comment: b.trip.comment || undefined,
    },
  };
});

  return c.json(formatted);
});

/**
 * Заявки на поездку для водителя.
 * Этот эндпоинт нужен для TripRequestsPanel в mini-app.
 */
bookingsRouter.get("/trip/:tripId", async (c) => {
  const user = c.get("user");
  const tripId = c.req.param("tripId");

  const trip = await db.trip.findUnique({
    where: { id: tripId },
  });

  if (!trip) {
    return c.json({ message: "Trip not found" }, 404);
  }

  if (trip.driverId !== user.id) {
    return c.json({ message: "Forbidden" }, 403);
  }

  const bookings = await db.booking.findMany({
    where: {
      tripId,
    },
    include: {
      trip: {
        include: {
          driver: {
            include: {
              car: true,
            },
          },
        },
      },
      passenger: {
        include: {
          car: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return c.json(bookings.map(serializeBooking));
});

/**
 * Создание брони пассажиром.
 * Статус всегда pending.
 * Pending сразу удерживает место.
 */
bookingsRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createBookingDtoSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const { tripId, seat, comment } = parseResult.data;
  const passenger = c.get("user");

  try {
    const booking = await db.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        throw new BookingError("Trip not found", 404);
      }

      if (trip.status !== "active") {
        throw new BookingError("Trip is not active", 400);
      }

      if (trip.driverId === passenger.id) {
        throw new BookingError("Driver cannot book own trip", 400);
      }

      if (seat > trip.seatsTotal) {
        throw new BookingError("Seat is out of range", 400);
      }

      if (trip.seatsAvailable <= 0) {
        throw new BookingError("Not enough available seats", 400);
      }

      const seatConflict = await tx.booking.findFirst({
        where: {
          tripId,
          seat,
          status: {
            in: ["pending", "confirmed"],
          },
        },
      });

      if (seatConflict) {
        throw new BookingError("Seat is already reserved", 409);
      }

      const passengerConflict = await tx.booking.findFirst({
        where: {
          tripId,
          passengerId: passenger.id,
          status: {
            in: ["pending", "confirmed"],
          },
        },
      });

      if (passengerConflict) {
        throw new BookingError(
          "You already have an active booking for this trip",
          409
        );
      }

      await tx.trip.update({
        where: { id: tripId },
        data: {
          seatsAvailable: trip.seatsAvailable - 1,
        },
      });

      const created = await tx.booking.create({
        data: {
          tripId,
          passengerId: passenger.id,
          seat,
          comment,
          status: "pending",
        },
        include: {
          trip: {
            include: {
              driver: {
                include: {
                  car: true,
                },
              },
            },
          },
          passenger: {
            include: {
              car: true,
            },
          },
        },
      });

      return created;
    });

    return c.json(serializeBooking(booking), 201);
  } catch (error) {
    if (error instanceof BookingError) {
      return c.json({ message: error.message }, error.status);
    }

    logger.error(
      {
        err: error,
        endpoint: "POST /api/bookings",
      },
      "booking_create_failed"
    );

    return c.json({ message: "Internal server error" }, 500);
  }
});

/**
 * Смена статуса брони водителем.
 * pending/confirmed считаются активным удержанием места.
 * declined освобождает место.
 */
bookingsRouter.patch("/:id/status", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateBookingStatusDtoSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ message: "Invalid payload" }, 400);
  }

  const newStatus = parseResult.data.status;

  try {
    const updated = await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          trip: {
            include: {
              driver: {
                include: {
                  car: true,
                },
              },
            },
          },
          passenger: {
            include: {
              car: true,
            },
          },
        },
      });

      if (!booking) {
        throw new BookingError("Booking not found", 404);
      }

      if (booking.trip.driverId !== user.id) {
        throw new BookingError("Forbidden", 403);
      }

      if (booking.status === newStatus) {
        return booking;
      }

      const trip = await tx.trip.findUnique({
        where: { id: booking.tripId },
      });

      if (!trip) {
        throw new BookingError("Trip not found", 404);
      }

      const oldStatus = booking.status;

      /**
       * Если бронь становится confirmed, проверяем,
       * что на этом месте нет другого подтверждённого пассажира.
       */
      if (newStatus === "confirmed") {
        const confirmedConflict = await tx.booking.findFirst({
          where: {
            tripId: booking.tripId,
            seat: booking.seat,
            status: "confirmed",
            id: {
              not: booking.id,
            },
          },
        });

        if (confirmedConflict) {
          throw new BookingError(
            "Another passenger is already confirmed for this seat",
            409
          );
        }
      }

      /**
       * Если бронь переходит из неактивного состояния в активное,
       * нужно снова удержать место.
       */
      if (isActiveBookingStatus(newStatus) && !isActiveBookingStatus(oldStatus)) {
        if (trip.status !== "active") {
          throw new BookingError("Trip is not active", 400);
        }

        if (trip.seatsAvailable <= 0) {
          throw new BookingError("Not enough available seats", 400);
        }

        const activeConflict = await tx.booking.findFirst({
          where: {
            tripId: booking.tripId,
            seat: booking.seat,
            status: {
              in: [...ACTIVE_BOOKING_STATUSES],
            },
            id: {
              not: booking.id,
            },
          },
        });

        if (activeConflict) {
          throw new BookingError("Seat is already reserved", 409);
        }

        await tx.trip.update({
          where: { id: booking.tripId },
          data: {
            seatsAvailable: trip.seatsAvailable - 1,
          },
        });
      }

      /**
       * Если активная бронь становится неактивной,
       * освобождаем место.
       */
      if (!isActiveBookingStatus(newStatus) && isActiveBookingStatus(oldStatus)) {
        await tx.trip.update({
          where: { id: booking.tripId },
          data: {
            seatsAvailable: Math.min(
              trip.seatsAvailable + 1,
              trip.seatsTotal
            ),
          },
        });
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: newStatus,
        },
        include: {
          trip: {
            include: {
              driver: {
                include: {
                  car: true,
                },
              },
            },
          },
          passenger: {
            include: {
              car: true,
            },
          },
        },
      });

      return updatedBooking;
    });

    return c.json(serializeBooking(updated));
  } catch (error) {
    if (error instanceof BookingError) {
      return c.json({ message: error.message }, error.status);
    }

    logger.error(
      {
        err: error,
        endpoint: "PATCH /api/bookings/:id/status",
      },
      "booking_status_update_failed"
    );

    return c.json({ message: "Internal server error" }, 500);
  }
});

/**
 * Отмена брони пассажиром.
 *
 * Правила:
 * - отменять может только пассажир, который создал бронь;
 * - отменять можно только pending/confirmed;
 * - поездка должна быть active;
 * - активная бронь освобождает место.
 */
bookingsRouter.patch("/:id/cancel", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  try {
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          trip: true,
        },
      });

      if (!booking) {
        throw new BookingError("Booking not found", 404);
      }

      if (booking.passengerId !== user.id) {
        throw new BookingError("Forbidden", 403);
      }

      if (booking.status !== "pending" && booking.status !== "confirmed") {
        throw new BookingError("Booking is already cancelled", 400);
      }

      if (booking.trip.status !== "active") {
        throw new BookingError("Trip is not active", 400);
      }

      if (booking.trip.departureAt <= new Date()) {
        throw new BookingError(
          "Cannot cancel booking after trip departure",
          400
        );
      }

      await tx.trip.update({
        where: { id: booking.tripId },
        data: {
          seatsAvailable: Math.min(
            booking.trip.seatsAvailable + 1,
            booking.trip.seatsTotal
          ),
        },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "declined",
        },
      });
    });

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof BookingError) {
      return c.json({ message: error.message }, error.status);
    }

    logger.error(
      {
        err: error,
        endpoint: "PATCH /api/bookings/:id/cancel",
      },
      "booking_cancel_failed"
    );

    return c.json({ message: "Internal server error" }, 500);
  }
});

