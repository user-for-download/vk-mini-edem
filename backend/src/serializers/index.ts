// backend/src/serializers/index.ts
import type { Prisma } from "@prisma/client";
import type { BookingStatus, TripStatus } from "@edem/contracts";

export type UserWithCar = Prisma.UserGetPayload<{
  include: {
    car: boolean;
  };
}>;

export type TripWithDriver = Prisma.TripGetPayload<{
  include: {
    driver: {
      include: {
        car: boolean;
      };
    };
  };
}>;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    trip: {
      include: {
        driver: {
          include: {
            car: boolean;
          };
        };
      };
    };
    passenger: {
      include: {
        car: boolean;
      };
    };
  };
}>;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{
  include: {
    author: boolean;
  };
}>;

export function safeParseTags(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function formatDateRu(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
}

export function formatTimeRu(date: Date): string {
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function serializeUser(user: UserWithCar) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    rating: user.rating,
    reviewsCount: user.reviewsCount,
    tripsCount: user.tripsCount,
    isVerified: user.isVerified,
    car: user.car
      ? {
          model: user.car.model,
          color: user.car.color,
          plate: user.car.plate,
        }
      : undefined,
    about: user.about ?? undefined,
    createdAt: user.createdAt.toISOString(),
  };
}

export function serializeTrip(
  trip: TripWithDriver,
  options?: {
    bookedSeats?: number[];
    pendingRequestsCount?: number;
  }
) {
  return {
    id: trip.id,
    fromCity: trip.fromCity,
    fromAddress: trip.fromAddress,
    toCity: trip.toCity,
    toAddress: trip.toAddress,
    date: formatDateRu(trip.departureAt),
    time: formatTimeRu(trip.departureAt),
    departureAt: trip.departureAt.toISOString(),
    durationMinutes: trip.durationMinutes,
    distanceKm: trip.distanceKm,
    price: trip.price,
    seatsTotal: trip.seatsTotal,
    seatsAvailable: trip.seatsAvailable,
    driver: serializeUser(trip.driver),
    tags: safeParseTags(trip.tags),
    comment: trip.comment ?? undefined,
    status: trip.status as TripStatus,
    bookedSeats: options?.bookedSeats ?? [],
    pendingRequestsCount: options?.pendingRequestsCount,
  };
}

export function serializeBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    seat: booking.seat,
    status: booking.status as BookingStatus,
    comment: booking.comment ?? undefined,
    passenger: serializeUser(booking.passenger),
    trip: serializeTrip(booking.trip),
  };
}

export function serializeReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    targetRole: review.targetRole as "passenger" | "driver",
    rating: review.rating,
    text: review.text,
    date: review.createdAt.toLocaleDateString("ru-RU", {
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
