export const TRIP_STATUS = {
  ACTIVE: "active",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

export const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  CANCELLED: "cancelled",
} as const;

export const REVIEW_STATUS = {
  PENDING: "pending",
  PUBLISHED: "published",
  REJECTED: "rejected",
} as const;

export type TripStatusValue = (typeof TRIP_STATUS)[keyof typeof TRIP_STATUS];
export type BookingStatusValue = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];
export type ReviewStatusValue = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const ACTIVE_BOOKING_STATUSES: readonly BookingStatusValue[] = [
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
];

export const REVIEW_STATUSES: readonly ReviewStatusValue[] = Object.values(REVIEW_STATUS);

export function isActiveBookingStatus(status: string): boolean {
  return (ACTIVE_BOOKING_STATUSES as readonly string[]).includes(status);
}
