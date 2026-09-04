// backend/src/admin/serializers.ts
// Админ-DTO: плоские формы с ISO-датами, именами связанных сущностей
// и админ-полями (bannedAt), которых нет в публичных сериализаторах.
import type { Prisma, User } from "../generated/prisma/client.js";
import type {
  AdminBookingDto,
  AdminFeedbackDto,
  AdminReviewDto,
  AdminTripDto,
  AdminUserDto,
  ReviewStatusValue,
} from "@edem/contracts";
import { DEFAULT_AVATAR_URL } from "../constants.js";

export type TripWithDriver = Prisma.TripGetPayload<{
  include: {
    driver: boolean;
  };
}>;

export type BookingWithTripAndPassenger = Prisma.BookingGetPayload<{
  include: {
    trip: boolean;
    passenger: boolean;
  };
}>;

export type ReviewWithAuthorAndTarget = Prisma.ReviewGetPayload<{
  include: {
    author: boolean;
    targetUser: boolean;
  };
}>;

export type FeedbackWithUser = Prisma.FeedbackGetPayload<{
  include: {
    user: boolean;
  };
}>;

/**
 * Пользователь для админ-панели: без машины, но с bannedAt и banReason.
 * banReason может быть null для старых банов, проставленных до миграции
 * `add_user_ban_reason`.
 */
export function serializeAdminUser(user: User): AdminUserDto {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar || DEFAULT_AVATAR_URL,
    rating: user.rating,
    tripsCount: user.tripsCount,
    reviewsCount: user.reviewsCount,
    isVerified: user.isVerified,
    bannedAt: user.bannedAt?.toISOString() ?? null,
    banReason: user.banReason ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Поездка для админ-панели: маршрут, места, цена, статус, имя водителя.
 */
export function serializeAdminTrip(trip: TripWithDriver): AdminTripDto {
  return {
    id: trip.id,
    fromCity: trip.fromCity,
    toCity: trip.toCity,
    fromAddress: trip.fromAddress,
    toAddress: trip.toAddress,
    price: trip.price,
    seatsTotal: trip.seatsTotal,
    seatsAvailable: trip.seatsAvailable,
    status: trip.status,
    departureAt: trip.departureAt.toISOString(),
    createdAt: trip.createdAt.toISOString(),
    driverId: trip.driverId,
    driverName: trip.driver.name,
  };
}

/**
 * Бронирование для админ-панели: место, статус, маршрут поездки, имя пассажира.
 */
export function serializeAdminBooking(
  booking: BookingWithTripAndPassenger
): AdminBookingDto {
  return {
    id: booking.id,
    seat: booking.seat,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    tripId: booking.tripId,
    tripRoute: `${booking.trip.fromCity} → ${booking.trip.toCity}`,
    passengerId: booking.passengerId,
    passengerName: booking.passenger.name,
  };
}

/**
 * Отзыв для админ-панели: автор, получатель, оценка, текст, маршрут.
 */
export function serializeAdminReview(
  review: ReviewWithAuthorAndTarget
): AdminReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    text: review.text,
    targetRole: review.targetRole,
    // Статус модерации (pending/published/rejected) — часть контракта
    // adminReviewDtoSchema; в БД хранится как String.
    status: review.status as ReviewStatusValue,
    tripRoute: review.tripRoute,
    createdAt: review.createdAt.toISOString(),
    authorId: review.authorId,
    authorName: review.author.name,
    targetUserId: review.targetUserId,
    targetUserName: review.targetUser.name,
  };
}

/**
 * Обращение пользователя в поддержку для админ-панели.
 * `reply` и `repliedAt` — null, пока админ не ответил.
 */
export function serializeAdminFeedback(
  feedback: FeedbackWithUser
): AdminFeedbackDto {
  return {
    id: feedback.id,
    subject: feedback.subject,
    text: feedback.text,
    reply: feedback.reply,
    repliedAt: feedback.repliedAt?.toISOString() ?? null,
    createdAt: feedback.createdAt.toISOString(),
    userId: feedback.userId,
    userName: feedback.user.name,
  };
}
