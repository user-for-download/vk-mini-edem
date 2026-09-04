// backend/src/serializers/index.ts
import type { Prisma } from "../generated/prisma/client.js";
import type { BookingStatus, ReviewStatusValue, TripStatus } from "@edem/contracts";
import { DEFAULT_AVATAR_URL } from "../constants.js";

/**
 * Единый часовой пояс для отображения дат и времени.
 * Без явного timeZone Intl.DateTimeFormat использует TZ контейнера
 * (в проде обычно UTC), что сдвигает время на экране пользователя.
 */
const DISPLAY_TIMEZONE = "Europe/Moscow";

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
  timeZone: DISPLAY_TIMEZONE,
});

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIMEZONE,
});

export function formatDateRu(date: Date): string {
  return dateFmt.format(date);
}

export function formatTimeRu(date: Date): string {
  return timeFmt.format(date);
}

export function serializeUser(
  user: UserWithCar,
  options?: { includePlate?: boolean; includeVkUserId?: boolean }
) {
  return {
    id: user.id,
    // VK ID отдаётся только по явному флагу (участники активной брони),
    // чтобы клиент мог построить ссылку на ЛС vk.com/im?sel=<id>.
    ...(options?.includeVkUserId && user.vkUserId != null
      ? { vkUserId: user.vkUserId }
      : {}),
    name: user.name,
    avatar: user.avatar || DEFAULT_AVATAR_URL,
    rating: user.rating,
    reviewsCount: user.reviewsCount,
    tripsCount: user.tripsCount,
    isVerified: user.isVerified,
    notificationsEnabled: user.notificationsEnabled,
    verifiedAt: user.verifiedAt?.toISOString() ?? null,
    // Версия показанного онбординга (null — ещё не пройден или сброшен админом).
    onboardingVersion: user.onboardingVersion ?? null,
    car: user.car
      ? {
          model: user.car.model,
          color: user.car.color,
          ...(options?.includePlate === false ? {} : { plate: user.car.plate }),
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
    confirmedBookingsCount?: number;
    myBooking?: {
      id: string;
      seat: number;
      status: string;
      createdAt?: Date;
    } | null;
    includePlate?: boolean;
    includePrivateDetails?: boolean;
    includeVkUserId?: boolean;
  }
) {
  return {
    id: trip.id,
    fromCity: trip.fromCity,
    // В публичном режиме адреса встречи не отдаются: подстановка города
    // в поле адреса создавала дубли «Москва / Москва» на карточках.
    fromAddress: options?.includePrivateDetails === false ? undefined : trip.fromAddress,
    fromCityId: trip.fromCityId ?? null,
    toCity: trip.toCity,
    toAddress: options?.includePrivateDetails === false ? undefined : trip.toAddress,
    toCityId: trip.toCityId ?? null,
    date: formatDateRu(trip.departureAt),
    time: formatTimeRu(trip.departureAt),
    departureAt: trip.departureAt.toISOString(),
    durationMinutes: trip.durationMinutes,
    distanceKm: trip.distanceKm,
    price: trip.price,
    seatsTotal: trip.seatsTotal,
    seatsAvailable: trip.seatsAvailable,
    driver: serializeUser(trip.driver, {
      includePlate: options?.includePlate,
      includeVkUserId: options?.includeVkUserId,
    }),
    tags: trip.tags,
    comment: trip.comment ?? undefined,
    status: trip.status as TripStatus,
    bookedSeats: options?.bookedSeats ?? [],
    pendingRequestsCount: options?.pendingRequestsCount,
    confirmedBookingsCount: options?.confirmedBookingsCount,
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

export function serializeBooking(
  booking: BookingWithRelations,
  options?: { includeVkUserId?: boolean }
) {
  return {
    id: booking.id,
    seat: booking.seat,
    status: booking.status as BookingStatus,
    comment: booking.comment ?? undefined,
    // VK ID пассажира — только для водителя его собственной поездки
    // (ссылка «Написать»). По умолчанию поле не отдаётся.
    passenger: serializeUser(booking.passenger, {
      includeVkUserId: options?.includeVkUserId,
    }),
    trip: serializeTrip(booking.trip),
  };
}

const reviewDateFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: DISPLAY_TIMEZONE,
});

export function serializeReview(review: ReviewWithAuthor) {
  return {
    id: review.id,
    targetRole: review.targetRole as "passenger" | "driver",
    rating: review.rating,
    text: review.text,
    // Статус модерации (pending/published/rejected) — часть контракта
    // reviewSchema; в публичном списке отдаются только published.
    status: review.status as ReviewStatusValue,
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
