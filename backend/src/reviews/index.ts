// backend/src/reviews/index.ts
import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { createReviewDtoSchema } from "@edem/contracts";
import { db } from "../db.js";
import { requireUser, type AuthEnv } from "../auth/middleware.js";
import { logger } from "../logger.js";
import { serializeTrip, serializeReview, type TripWithDriver } from "../serializers/index.js";

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

  return c.json(availableTrips.map((trip) => serializeTrip(trip)));
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

  const now = new Date();
  const isTripCompleted = trip.status === "completed";
  const isTripPast = trip.departureAt <= now;

  if (!isTripCompleted && !isTripPast) {
    return c.json(
      { message: "Trip has not started or completed yet" },
      400
    );
  }

  if (trip.status === "active" && isTripPast) {
    logger.warn(
      { tripId: trip.id },
      "Review for non-completed past trip"
    );
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
    logger.error(
      {
        err: error,
        endpoint: "POST /api/reviews",
      },
      "review_create_failed"
    );

    return c.json({ message: "Internal server error" }, 500);
  }
});
