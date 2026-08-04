// mini-app/src/modals/CreateTripModal/validation.ts

export interface TripFormValues {
  fromCity: string;
  fromAddress: string;
  toCity: string;
  toAddress: string;
  date: string;
  time: string;
  durationMinutes: string;
  distanceKm: string;
  price: string;
  seats: number;
  comment: string;
}

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export const initialFormValues: TripFormValues = {
  fromCity: "",
  fromAddress: "",
  toCity: "",
  toAddress: "",
  date: "",
  time: "",
  durationMinutes: "",
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

  // Откуда: город
  if (!values.fromCity.trim()) {
    errors.fromCity = "Укажите город отправления";
  } else if (values.fromCity.trim().length < 2) {
    errors.fromCity = "Минимум 2 символа";
  }

  // Откуда: адрес
  if (values.fromAddress.trim().length > MAX_ADDRESS_LENGTH) {
    errors.fromAddress = `Максимум ${MAX_ADDRESS_LENGTH} символов`;
  }

  // Куда: город
  if (!values.toCity.trim()) {
    errors.toCity = "Укажите город назначения";
  } else if (values.toCity.trim().length < 2) {
    errors.toCity = "Минимум 2 символа";
  } else if (
    values.toCity.trim().toLowerCase() === values.fromCity.trim().toLowerCase()
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
    const dateValue = new Date(`${values.date}T00:00:00`);

    if (Number.isNaN(dateValue.getTime())) {
      errors.date = "Некорректная дата";
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateValue < today) {
        errors.date = "Дата поездки уже прошла";
      }
    }
  }

  // Время
  if (!values.time.trim()) {
    errors.time = "Укажите время отправления";
  } else if (!TIME_REGEX.test(values.time.trim())) {
    errors.time = "Формат: ЧЧ:ММ, например 09:30";
  }

  // Длительность
  if (!values.durationMinutes.trim()) {
    errors.durationMinutes = "Укажите длительность поездки";
  } else {
    const duration = Number(values.durationMinutes.replace(/\s/g, ""));

    if (!Number.isFinite(duration) || duration <= 0) {
      errors.durationMinutes = "Длительность должна быть положительным числом";
    } else if (!Number.isInteger(duration)) {
      errors.durationMinutes = "Укажите целое число минут";
    } else if (duration > 60 * 24 * 7) {
      errors.durationMinutes = "Слишком большая длительность поездки";
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
  if (values.seats < 1 || values.seats > 4) {
    errors.seats = "От 1 до 4 мест";
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
