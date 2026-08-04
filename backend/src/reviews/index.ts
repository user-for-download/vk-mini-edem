// backend/src/reviews/index.ts
import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { createReviewDtoSchema } from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";

type ReviewWithAuthor = Prisma.ReviewGetPayload<{
  include: {
    author: true;
  };
}>;

type TripWithDriver = Prisma.TripGetPayload<{
  include: {
    driver: {
      include: {
        car: true;
      };
    };
  };
}>;

function safeParseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function serializeTrip(trip: TripWithDriver) {
  return {
    id: trip.id,
    fromCity: trip.fromCity,
    fromAddress: trip.fromAddress,
    toCity: trip.toCity,
    toAddress: trip.toAddress,
    date: new Date(trip.departureAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      weekday: "short",
    }),
    time: new Date(trip.departureAt).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    durationMinutes: trip.durationMinutes,
    distanceKm: trip.distanceKm,
    price: trip.price,
    seatsTotal: trip.seatsTotal,
    seatsAvailable: trip.seatsAvailable,
    driver: {
      id: trip.driver.id,
      name: trip.driver.name,
      avatar: trip.driver.avatar,
      rating: trip.driver.rating,
      reviewsCount: trip.driver.reviewsCount,
      tripsCount: trip.driver.tripsCount,
      isVerified: trip.driver.isVerified,
      car: trip.driver.car
        ? {
            model: trip.driver.car.model,
            color: trip.driver.car.color,
            plate: trip.driver.car.plate,
          }
        : undefined,
    },
    tags: safeParseTags(trip.tags),
    comment: trip.comment ?? undefined,
    status: trip.status as "active" | "cancelled" | "completed",
  };
}

function serializeReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    targetRole: review.targetRole as "passenger" | "driver",
    rating: review.rating,
    text: review.text,
    date: new Date(review.createdAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    tripRoute: review.tripRoute,
    author: {
      id: review.author.id,
      name: review.author.name,
      avatar: review.author.avatar,
      rating: review.author.rating,
      reviewsCount: review.author.reviewsCount,
      tripsCount: review.author.tripsCount,
    },
  };
}

export const reviewsRouter = new Hono<AuthEnv>();

/**
 * Отзывы, оставленные текущим пользователем.
 */
reviewsRouter.get("/my", requireUser, async (c) => {
  const user = c.get("user");

  const reviews = await db.review.findMany({
    where: {
      authorId: user.id,
    },
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return c.json(
    reviews.map((review) => ({
      ...serializeReview(review),
      tripId: review.tripId ?? undefined,
    }))
  );
});

/**
 * Поездки, доступные текущему пользователю для отзыва.
 *
 * Логика:
 * - пользователь был пассажиром;
 * - бронь подтверждена;
 * - поездка не отменена;
 * - поездка уже прошла;
 * - пользователь еще не оставлял отзыв по этой поездке.
 */
reviewsRouter.get("/available-trips", requireUser, async (c) => {
  const user = c.get("user");
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      passengerId: user.id,
      status: "confirmed",
      trip: {
        status: {
          not: "cancelled",
        },
        departureAt: {
          lt: now,
        },
      },
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
    },
    orderBy: {
      trip: {
        departureAt: "desc",
      },
    },
  });

  const tripIds = Array.from(new Set(bookings.map((b) => b.tripId)));

  if (tripIds.length === 0) {
    return c.json([]);
  }

  const existingReviews = await db.review.findMany({
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
    existingReviews
      .map((review) => review.tripId)
      .filter((tripId): tripId is string => Boolean(tripId))
  );

  const availableTripsMap = new Map<string, TripWithDriver>();

  for (const booking of bookings) {
    if (!reviewedTripIds.has(booking.tripId)) {
      availableTripsMap.set(booking.tripId, booking.trip);
    }
  }

  const availableTrips = Array.from(availableTripsMap.values());

  return c.json(availableTrips.map(serializeTrip));
});

reviewsRouter.get("/available", requireUser, async (c) => {
  const user = c.get("user");
  const now = new Date();

  const candidates: Array<{
    id: string;
    tripId: string;
    targetRole: "driver" | "passenger";
    trip: any;
    target: any;
  }> = [];

  const passengerBookings = await db.booking.findMany({
    where: {
      passengerId: user.id,
      status: "confirmed",
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
    },
  });

  for (const booking of passengerBookings) {
    const trip = booking.trip;
    const isTripCompleted =
      trip.status === "completed" || trip.departureAt <= now;

    if (trip.status === "cancelled" || !isTripCompleted) {
      continue;
    }

    candidates.push({
      id: `${trip.id}:${trip.driver.id}`,
      tripId: trip.id,
      targetRole: "driver",
      trip,
      target: trip.driver,
    });
  }

  const driverTrips = await db.trip.findMany({
    where: {
      driverId: user.id,
    },
    include: {
      bookings: {
        where: {
          status: "confirmed",
        },
        include: {
          passenger: {
            include: {
              car: true,
            },
          },
        },
      },
      driver: {
        include: {
          car: true,
        },
      },
    },
  });

  for (const trip of driverTrips) {
    const isTripCompleted =
      trip.status === "completed" || trip.departureAt <= now;

    if (trip.status === "cancelled" || !isTripCompleted) {
      continue;
    }

    for (const booking of trip.bookings) {
      if (booking.passengerId === user.id) {
        continue;
      }

      candidates.push({
        id: `${trip.id}:${booking.passengerId}`,
        tripId: trip.id,
        targetRole: "passenger",
        trip,
        target: booking.passenger,
      });
    }
  }

  if (candidates.length === 0) {
    return c.json([]);
  }

  const tripIds = Array.from(new Set(candidates.map((item) => item.tripId)));

  const existingReviews = await db.review.findMany({
    where: {
      authorId: user.id,
      tripId: {
        in: tripIds,
      },
    },
    select: {
      tripId: true,
      targetUserId: true,
    },
  });

  const reviewedKeys = new Set(
    existingReviews.map((review) => `${review.tripId}:${review.targetUserId}`)
  );

  const available = candidates
    .filter((candidate) => !reviewedKeys.has(candidate.id))
    .sort((a, b) => b.trip.departureAt.getTime() - a.trip.departureAt.getTime());

  return c.json(
    available.map((item) => ({
      id: item.id,
      targetRole: item.targetRole,
      trip: serializeTrip(item.trip),
      target: {
        id: item.target.id,
        name: item.target.name,
        avatar: item.target.avatar,
        rating: item.target.rating,
        reviewsCount: item.target.reviewsCount,
        tripsCount: item.target.tripsCount,
        car: item.target.car
          ? {
              model: item.target.car.model,
              color: item.target.car.color,
              plate: item.target.car.plate,
            }
          : undefined,
      },
    }))
  );
});

/**
 * Публичный список отзывов о пользователе.
 */
reviewsRouter.get("/user/:userId", async (c) => {
  const userId = c.req.param("userId");

  const targetUser = await db.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    return c.json({ message: "User not found" }, 404);
  }

  const reviews = await db.review.findMany({
    where: {
      targetUserId: userId,
    },
    include: {
      author: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return c.json(reviews.map(serializeReview));
});

/**
 * Создание отзыва.
 *
 * Правила:
 * - автор = текущий пользователь;
 * - нельзя оставить отзыв самому себе;
 * - поездка должна существовать;
 * - поездка не должна быть отменённой;
 * - поездка должна уже начаться/пройти;
 * - автор и target должны быть участниками поездки;
 * - нельзя оставить повторный отзыв тому же пользователю по той же поездке;
 * - после создания отзыва пересчитываются rating и reviewsCount.
 */
reviewsRouter.post("/", requireUser, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = createReviewDtoSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400
    );
  }

  const { tripId, targetUserId, rating, text } = parseResult.data;

  const author = c.get("user");

  if (author.id === targetUserId) {
    return c.json({ message: "Cannot review yourself" }, 400);
  }

  const [targetUser, trip] = await Promise.all([
    db.user.findUnique({
      where: { id: targetUserId },
    }),
    db.trip.findUnique({
      where: { id: tripId },
    }),
  ]);

  if (!targetUser) {
    return c.json({ message: "Target user not found" }, 404);
  }

  if (!trip) {
    return c.json({ message: "Trip not found" }, 404);
  }

  if (trip.status === "cancelled") {
    return c.json({ message: "Trip is cancelled" }, 400);
  }

  if (trip.departureAt > new Date()) {
    return c.json({ message: "Trip has not started yet" }, 400);
  }

  /**
   * Проверяем, что автор отзыва участвовал в поездке.
   */
  const isAuthorDriver = trip.driverId === author.id;

  if (!isAuthorDriver) {
    const authorBooking = await db.booking.findFirst({
      where: {
        tripId: trip.id,
        passengerId: author.id,
        status: "confirmed",
      },
    });

    if (!authorBooking) {
      return c.json(
        { message: "You did not participate in this trip" },
        403
      );
    }
  }

  /**
   * Проверяем, что target-пользователь участвовал в поездке.
   */
  const isTargetDriver = trip.driverId === targetUserId;

  if (!isTargetDriver) {
    const targetBooking = await db.booking.findFirst({
      where: {
        tripId: trip.id,
        passengerId: targetUserId,
        status: "confirmed",
      },
    });

    if (!targetBooking) {
      return c.json(
        { message: "Target user did not participate in this trip" },
        400
      );
    }
  }

  const targetRole = isTargetDriver ? "driver" : "passenger";
  const tripRoute = `${trip.fromCity} → ${trip.toCity}`;

  /**
   * Запрещаем повторный отзыв тому же пользователю по той же поездке.
   */
  const existingReview = await db.review.findFirst({
    where: {
      authorId: author.id,
      tripId: trip.id,
      targetUserId,
    },
  });

  if (existingReview) {
    return c.json(
      { message: "You already reviewed this user for this trip" },
      409
    );
  }

  try {
    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          authorId: author.id,
          targetUserId,
          targetRole,
          rating,
          text,
          tripRoute,
          tripId: trip.id,
        },
        include: {
          author: true,
        },
      });

      const aggregate = await tx.review.aggregate({
        where: {
          targetUserId,
        },
        _avg: {
          rating: true,
        },
        _count: {
          _all: true,
        },
      });

      const avgRating = aggregate._avg.rating ?? 0;

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          rating: Number(avgRating.toFixed(1)),
          reviewsCount: aggregate._count._all,
        },
      });

      return created;
    });

    return c.json(serializeReview(review), 201);
  } catch (error) {
    console.error("[Reviews] Create review failed:", error);
    return c.json({ message: "Internal server error" }, 500);
  }
});
