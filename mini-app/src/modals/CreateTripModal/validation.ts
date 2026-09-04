// mini-app/src/modals/CreateTripModal/validation.ts
import { MAX_SEATS, type TripTag, type CityDto } from "@edem/contracts";
import { moscowWallClockToIso } from "@/helpers/moscowTime";

export interface TripFormValues {
  fromCity: CityDto | null;
  fromAddress: string;
  toCity: CityDto | null;
  toAddress: string;
  date: string;
  time: string;
  /** Время в пути в часах (водитель вводит целые часы); в API уходит durationMinutes = часы × 60. */
  durationHours: string;
  distanceKm: string;
  price: string;
  seats: number;
  comment: string;
}

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export const initialFormValues: TripFormValues = {
  fromCity: null,
  fromAddress: "",
  toCity: null,
  toAddress: "",
  date: "",
  time: "",
  durationHours: "",
  distanceKm: "",
  price: "",
  seats: 3,
  comment: "",
};

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_COMMENT_LENGTH = 500;
const MAX_ADDRESS_LENGTH = 200;

export function validateTripForm(values: TripFormValues): TripFormErrors {
  const errors: TripFormErrors = {};

  // Откуда: город (справочник)
  if (!values.fromCity) {
    errors.fromCity = "Выберите город отправления";
  }

  // Откуда: адрес
  if (values.fromAddress.trim().length > MAX_ADDRESS_LENGTH) {
    errors.fromAddress = `Максимум ${MAX_ADDRESS_LENGTH} символов`;
  }

  // Куда: город (справочник)
  if (!values.toCity) {
    errors.toCity = "Выберите город назначения";
  } else if (
    values.fromCity &&
    values.toCity.id === values.fromCity.id
  ) {
    errors.toCity = "Города отправления и назначения совпадают";
  }

  // Куда: адрес
  if (values.toAddress.trim().length > MAX_ADDRESS_LENGTH) {
    errors.toAddress = `Максимум ${MAX_ADDRESS_LENGTH} символов`;
  }

  // Дата
  if (!values.date.trim()) {
    errors.date = "Укажите дату поездки";
  } else {
    const dateValue = moscowWallClockToIso(values.date, "00:00");

    if (!dateValue) {
      errors.date = "Некорректная дата";
    } else if (values.time.trim() && TIME_REGEX.test(values.time.trim())) {
      const departureTime = moscowWallClockToIso(values.date, values.time.trim());
      if (!departureTime) {
        errors.date = "Некорректная дата";
      } else if (Date.parse(departureTime) <= Date.now()) {
        errors.time = "Укажите время в будущем";
      }
    }
  }

  // Время
  if (!values.time.trim()) {
    errors.time = "Укажите время отправления";
  } else if (!TIME_REGEX.test(values.time.trim())) {
    errors.time = "Формат: ЧЧ:ММ, например 09:30";
  }

  // Время в пути (в часах; в API конвертируется в минуты)
  if (!values.durationHours.trim()) {
    errors.durationHours = "Укажите время в пути";
  } else {
    const hours = Number(values.durationHours.replace(/\s/g, ""));

    if (!Number.isFinite(hours) || hours <= 0) {
      errors.durationHours = "Время в пути должно быть положительным числом";
    } else if (!Number.isInteger(hours)) {
      errors.durationHours = "Укажите целое число часов";
    } else if (hours > 24 * 7) {
      errors.durationHours = "Слишком большое время в пути";
    }
  }

  // Расстояние
  if (!values.distanceKm.trim()) {
    errors.distanceKm = "Укажите расстояние";
  } else {
    const distance = Number(values.distanceKm.replace(",", "."));

    if (!Number.isFinite(distance) || distance <= 0) {
      errors.distanceKm = "Расстояние должно быть положительным числом";
    } else if (distance > 20000) {
      errors.distanceKm = "Слишком большое расстояние";
    }
  }

  // Цена
  if (!values.price.trim()) {
    errors.price = "Укажите цену за место";
  } else {
    const priceNum = Number(values.price.replace(/\s/g, ""));

    if (Number.isNaN(priceNum) || priceNum <= 0) {
      errors.price = "Цена должна быть положительным числом";
    } else if (!Number.isInteger(priceNum)) {
      errors.price = "Укажите целое число рублей";
    } else if (priceNum > 100000) {
      errors.price = "Цена не может превышать 100 000 ₽";
    }
  }

  // Места
  if (values.seats < 1 || values.seats > MAX_SEATS) {
    errors.seats = `От 1 до ${MAX_SEATS} мест`;
  }

  // Комментарий
  if (values.comment.length > MAX_COMMENT_LENGTH) {
    errors.comment = `Максимум ${MAX_COMMENT_LENGTH} символов`;
  }

  return errors;
}

export function isFormValid(errors: TripFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

export interface TripFormDraft {
  values: TripFormValues;
  selectedTags: TripTag[];
}

const STRING_VALUE_FIELDS = [
  "fromAddress",
  "toAddress",
  "date",
  "time",
  "durationHours",
  "distanceKm",
  "price",
  "comment",
] as const;

function isCity(value: unknown): value is CityDto {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string";
}

function isTripFormValues(value: unknown): value is TripFormValues {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    STRING_VALUE_FIELDS.every((field) => typeof record[field] === "string") &&
    typeof record.seats === "number" &&
    (record.fromCity === null || isCity(record.fromCity)) &&
    (record.toCity === null || isCity(record.toCity))
  );
}

/**
 * Type guard черновика формы поездки для readDraft.
 * Повреждённый/устаревший черновик (нет полей, неверные типы) отбрасывается,
 * чтобы рендер не падал на undefined.length / undefined.trim().
 */
export function isTripFormDraft(value: unknown): value is TripFormDraft {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    isTripFormValues(record.values) &&
    Array.isArray(record.selectedTags) &&
    record.selectedTags.every((tag) => typeof tag === "string")
  );
}
