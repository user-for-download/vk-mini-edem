// backend/src/serializers/index.ts
import type { Prisma } from "@prisma/client";
import type { BookingStatus, TripStatus } from "@edem/contracts";
import { DEFAULT_AVATAR_URL } from "../constants.js";

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

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  weekday: "short",
});

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateRu(date: Date): string {
  return dateFmt.format(date);
}

export function formatTimeRu(date: Date): string {
  return timeFmt.format(date);
}

export function serializeUser(user: UserWithCar) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar || DEFAULT_AVATAR_URL,
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
    myBooking?: {
      id: string;
      seat: number;
      status: string;
      createdAt?: Date;
    } | null;
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
    tags: trip.tags,
    comment: trip.comment ?? undefined,
    status: trip.status as TripStatus,
    bookedSeats: options?.bookedSeats ?? [],
    pendingRequestsCount: options?.pendingRequestsCount,
    myBooking: options?.myBooking
      ? {
          id: options.myBooking.id,
          seat: options.myBooking.seat,
          status: options.myBooking.status as BookingStatus,
          createdAt: options.myBooking.createdAt
            ? options.myBooking.createdAt.toISOString()
            : undefined,
        }
      : null,
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

const reviewDateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function serializeReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    targetRole: review.targetRole as "passenger" | "driver",
    rating: review.rating,
    text: review.text,
    date: reviewDateFmt.format(review.createdAt),
    tripRoute: review.tripRoute,
    author: {
      id: review.author.id,
      name: review.author.name,
      avatar: review.author.avatar || DEFAULT_AVATAR_URL,
      rating: review.author.rating,
      reviewsCount: review.author.reviewsCount,
      tripsCount: review.author.tripsCount,
    },
  };
}
