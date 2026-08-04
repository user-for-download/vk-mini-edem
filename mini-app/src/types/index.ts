/**
 * Типы описывают форму данных, которые вёрстка ожидает получить.
 * Никакой логики здесь нет — только контракты для пропсов и моков.
 */

export type Role = "passenger" | "driver";

export interface Car {
  model: string;
  color: string;
  plate: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  tripsCount: number;
  isVerified?: boolean;
  notificationsEnabled?: boolean;
  verificationStatus?: string;
  verifiedAt?: string;
  car?: Car;
  about?: string;
  createdAt?: string;
}

export type TripTag =
  | "Можно с животными"
  | "Можно курить"
  | "Есть багаж"
  | "Только девушки"
  | "Тихая поездка"
  | "С остановками";

export interface Trip {
  id: string;
  fromCity: string;
  fromAddress: string;
  toCity: string;
  toAddress: string;
  date: string; // человекочитаемая дата, напр. "3 августа, вс"
  time: string; // "09:30"
  durationMinutes: number;
  distanceKm: number;
  price: number;
  seatsTotal: number;
  seatsAvailable: number;
  driver: User;
  tags: TripTag[];
  comment?: string;

  status?: "active" | "cancelled" | "completed";
  departureAt?: string;

  /**
   * Номера мест, занятых активными бронями.
   */
  bookedSeats?: number[];

  /**
   * Количество заявок в статусе pending.
   * Актуально для поездок водителя.
   */
  pendingRequestsCount?: number;
}

export type BookingStatus = "pending" | "confirmed" | "declined" | "cancelled";

export interface Booking {
  id: string;
  trip: Trip;
  passenger: User;
  seat: number;
  status: BookingStatus;
  comment?: string;

  /**
   * Поля, которые backend возвращает для истории поездок.
   * Делаем их обязательными, т.к. они всегда вычисляются на бэкенде.
   */
  canReview: boolean;
  hasReview: boolean;
  historyCategory?: "completed" | "cancelled" | "other";
}

/**
 * Расширенная бронь для экрана «Мои брони и история».
 *
 * Backend возвращает scope/canReview/hasReview,
 * чтобы клиент мог разделить активные и завершенные поездки
 * и показать кнопку «Оставить отзыв».
 */
export type PassengerBookingScope = "active" | "history";

export interface PassengerBooking extends Booking {
  scope: PassengerBookingScope;
  canReview: boolean;
  hasReview: boolean;

  /**
   * Переопределяем trip, чтобы добавить служебные поля.
   */
  trip: Trip & {
    status?: "active" | "cancelled" | "completed";
    departureAt?: string;
  };
}

export interface Review {
  id: string;
  author: User;
  targetRole: Role;
  rating: number;
  text: string;
  date: string;
  tripRoute: string;
}
