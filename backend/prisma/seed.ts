// backend/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Стандартный VK-плейсхолдер «нет фото».
 * Используется для всех сид-пользователей (совпадает с бэкенд-фолбэком).
 */
const DEFAULT_AVATAR_URL = "https://vk.com/images/camera_200.png?ava=1";

interface SeedCar {
  model: string;
  color: string;
  plate: string;
}

interface SeedUser {
  id: string;
  vkUserId: number;
  name: string;
  avatar: string;
  rating: number;
  reviewsCount: number;
  tripsCount: number;
  isVerified: boolean;
  verificationStatus: string; // none, pending, approved, rejected
  notificationsEnabled?: boolean;
  about?: string;
  car?: SeedCar;
}

interface SeedBooking {
  passengerId: string;
  seat: number;
  status: "pending" | "confirmed" | "declined";
  comment?: string;
}

interface SeedTrip {
  id: string;
  driverId: string;
  fromCity: string;
  fromAddress: string;
  toCity: string;
  toAddress: string;
  daysFromNow: number; // отрицательное — в прошлом
  durationMinutes: number;
  distanceKm: number;
  price: number;
  seatsTotal: number;
  status: "active" | "completed" | "cancelled";
  tags: string[];
  comment?: string;
  bookings: SeedBooking[];
}

interface SeedReview {
  id: string;
  authorId: string;
  targetUserId: string;
  targetRole: "passenger" | "driver";
  rating: number;
  text: string;
  tripRoute: string;
  tripId?: string;
}

// ─────────────────────────────────────────────────────────────
// Пользователи
// ─────────────────────────────────────────────────────────────
const users: SeedUser[] = [
  // Водители
  {
    id: "u-1",
    vkUserId: 100001,
    name: "Илья Северов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.9,
    reviewsCount: 34,
    tripsCount: 58,
    isVerified: true,
    verificationStatus: "approved",
    about: "За рулём 7 лет. Регулярно езжу между Москвой и СПб.",
    car: { model: "Skoda Octavia", color: "белый", plate: "А 217 МК 78" },
  },
  {
    id: "u-2",
    vkUserId: 100002,
    name: "Марина Ковалёва",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.8,
    reviewsCount: 21,
    tripsCount: 40,
    isVerified: true,
    verificationStatus: "approved",
    about: "Люблю комфортные спокойные поездки.",
    car: { model: "Kia Rio", color: "синий", plate: "В 804 ТР 777" },
  },
  {
    id: "u-3",
    vkUserId: 100003,
    name: "Алексей Громов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 5.0,
    reviewsCount: 15,
    tripsCount: 22,
    isVerified: true,
    verificationStatus: "approved",
    about: "Езжу аккуратно, в машине есть кондиционер и хорошая музыка.",
    car: { model: "Volkswagen Tiguan", color: "чёрный", plate: "Е 991 ЕЕ 199" },
  },
  {
    id: "u-5",
    vkUserId: 100005,
    name: "Дмитрий Соколов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.7,
    reviewsCount: 12,
    tripsCount: 30,
    isVerified: true,
    verificationStatus: "approved",
    about: "Командировки по области, беру максимум 2 попутчиков.",
    car: { model: "Toyota Camry", color: "серебристый", plate: "М 342 КХ 77" },
  },
  {
    id: "u-6",
    vkUserId: 100006,
    name: "Ольга Павлова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.9,
    reviewsCount: 8,
    tripsCount: 16,
    isVerified: true,
    verificationStatus: "approved",
    about: "Аккуратная езда, в машине всегда чисто. Только некурящие.",
    car: { model: "Hyundai Solaris", color: "красный", plate: "К 156 РУ 178" },
  },
  {
    id: "u-7",
    vkUserId: 100007,
    name: "Сергей Орлов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.6,
    reviewsCount: 5,
    tripsCount: 12,
    isVerified: false,
    verificationStatus: "pending",
    about: "Езжу по выходным за город, могу подбросить.",
    car: { model: "Renault Duster", color: "серый", plate: "С 803 СС 78" },
  },
  {
    id: "u-8",
    vkUserId: 100008,
    name: "Анна Волкова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 5.0,
    reviewsCount: 27,
    tripsCount: 45,
    isVerified: true,
    verificationStatus: "approved",
    about: "Люблю дальние поездки с приятной беседой.",
    car: { model: "Mazda CX-5", color: "голубой", plate: "Т 618 ВА 77" },
  },
  {
    id: "u-9",
    vkUserId: 100009,
    name: "Николай Зайцев",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.5,
    reviewsCount: 3,
    tripsCount: 8,
    isVerified: false,
    verificationStatus: "none",
    about: "Новичок в сервисе, езжу по выходным.",
    car: { model: "Lada Vesta", color: "белый", plate: "Х 455 УК 190" },
  },
  {
    id: "u-10",
    vkUserId: 100010,
    name: "Виктор Морозов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.8,
    reviewsCount: 19,
    tripsCount: 33,
    isVerified: true,
    verificationStatus: "approved",
    about: "Пунктуальный, выезжаю строго вовремя.",
    car: { model: "BMW 320i", color: "чёрный", plate: "О 912 ОК 77" },
  },
  {
    id: "u-11",
    vkUserId: 100011,
    name: "Татьяна Белова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.9,
    reviewsCount: 11,
    tripsCount: 25,
    isVerified: true,
    verificationStatus: "approved",
    about: "Езжу в Казань к родителям каждую неделю.",
    car: { model: "Kia Sportage", color: "белый", plate: "А 777 АА 77" },
  },
  {
    id: "u-12",
    vkUserId: 100012,
    name: "Андрей Лебедев",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.7,
    reviewsCount: 6,
    tripsCount: 14,
    isVerified: false,
    verificationStatus: "rejected",
    about: "Документы на проверке, но езжу аккуратно.",
    car: { model: "Skoda Rapid", color: "зелёный", plate: "Р 234 РМ 78" },
  },
  {
    id: "u-13",
    vkUserId: 100013,
    name: "Ирина Козлова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.8,
    reviewsCount: 9,
    tripsCount: 18,
    isVerified: true,
    verificationStatus: "approved",
    about: "Только с детским креслом при необходимости, по запросу.",
    car: { model: "Nissan Qashqai", color: "коричневый", plate: "У 567 НК 78" },
  },
  // Пассажиры
  {
    id: "u-4",
    vkUserId: 100004,
    name: "Елена Смирнова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.7,
    reviewsCount: 9,
    tripsCount: 14,
    isVerified: false,
    verificationStatus: "none",
    about: "Пассажир, часто езжу по делам в соседние города.",
  },
  {
    id: "u-14",
    vkUserId: 100014,
    name: "Павел Никитин",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.6,
    reviewsCount: 4,
    tripsCount: 10,
    isVerified: false,
    verificationStatus: "none",
    about: "Студент, езжу домой на выходные.",
  },
  {
    id: "u-15",
    vkUserId: 100015,
    name: "Наталья Фёдорова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 5.0,
    reviewsCount: 16,
    tripsCount: 21,
    isVerified: true,
    verificationStatus: "approved",
    about: "Пунктуальная, люблю тишину в дороге.",
  },
  {
    id: "u-16",
    vkUserId: 100016,
    name: "Михаил Тарасов",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.8,
    reviewsCount: 7,
    tripsCount: 13,
    isVerified: false,
    verificationStatus: "none",
    about: "Работаю вахтой, нужны поездки к поезду.",
  },
  {
    id: "u-17",
    vkUserId: 100017,
    name: "Светлана Егорова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.9,
    reviewsCount: 10,
    tripsCount: 17,
    isVerified: false,
    verificationStatus: "pending",
    about: "Езжу с дочкой, всегда аккуратно с временем.",
  },
  {
    id: "u-18",
    vkUserId: 100018,
    name: "Артём Киселёв",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.5,
    reviewsCount: 2,
    tripsCount: 5,
    isVerified: false,
    verificationStatus: "none",
    notificationsEnabled: false,
    about: "Спортсмен, иногда с большой сумкой.",
  },
  {
    id: "u-19",
    vkUserId: 100019,
    name: "Дарья Петрова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.8,
    reviewsCount: 13,
    tripsCount: 20,
    isVerified: true,
    verificationStatus: "approved",
    about: "Дизайнер, работаю удалённо, часто в поездках.",
  },
  {
    id: "u-20",
    vkUserId: 100020,
    name: "Роман Соловьёв",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.7,
    reviewsCount: 5,
    tripsCount: 9,
    isVerified: false,
    verificationStatus: "none",
    about: "Путешествую по Золотому кольцу.",
  },
  {
    id: "u-21",
    vkUserId: 100021,
    name: "Ксения Абрамова",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.9,
    reviewsCount: 8,
    tripsCount: 12,
    isVerified: false,
    verificationStatus: "none",
    about: "Медик, смены в разное время, ценю гибкость.",
  },
  {
    id: "u-22",
    vkUserId: 100022,
    name: "Олег Гусев",
    avatar: DEFAULT_AVATAR_URL,
    rating: 4.6,
    reviewsCount: 3,
    tripsCount: 7,
    isVerified: false,
    verificationStatus: "none",
    about: "Езжу к семье по выходным.",
  },
];

// ─────────────────────────────────────────────────────────────
// Поездки + брони
// ─────────────────────────────────────────────────────────────
const dayMs = 24 * 60 * 60 * 1000;

const trips: SeedTrip[] = [
  // ── Прошлые (completed) ──
  {
    id: "t-past-1",
    driverId: "u-1",
    fromCity: "Москва",
    fromAddress: "м. Калужская",
    toCity: "Тула",
    toAddress: "Центр",
    daysFromNow: -3,
    durationMinutes: 140,
    distanceKm: 185,
    price: 650,
    seatsTotal: 4,
    status: "completed",
    tags: ["Тихая поездка", "С остановками"],
    comment: "Отличная поездка в Тулу и обратно.",
    bookings: [
      { passengerId: "u-4", seat: 1, status: "confirmed", comment: "Спасибо за поездку!" },
      { passengerId: "u-15", seat: 2, status: "confirmed" },
    ],
  },
  {
    id: "t-past-2",
    driverId: "u-2",
    fromCity: "Москва",
    fromAddress: "м. ВДНХ",
    toCity: "Ярославль",
    toAddress: "Ж/д вокзал Главный",
    daysFromNow: -5,
    durationMinutes: 210,
    distanceKm: 265,
    price: 750,
    seatsTotal: 3,
    status: "completed",
    tags: ["Можно с животными", "Есть багаж"],
    bookings: [
      { passengerId: "u-4", seat: 2, status: "confirmed", comment: "Прекрасная поездка!" },
    ],
  },
  {
    id: "t-past-3",
    driverId: "u-8",
    fromCity: "Санкт-Петербург",
    fromAddress: "м. Московская",
    toCity: "Москва",
    toAddress: "м. Тёплый Стан",
    daysFromNow: -7,
    durationMinutes: 470,
    distanceKm: 705,
    price: 1500,
    seatsTotal: 4,
    status: "completed",
    tags: ["Есть багаж", "Разговорчивый"],
    bookings: [
      { passengerId: "u-19", seat: 1, status: "confirmed", comment: "Всё отлично!" },
      { passengerId: "u-20", seat: 3, status: "confirmed" },
      { passengerId: "u-21", seat: 4, status: "confirmed" },
    ],
  },
  {
    id: "t-past-4",
    driverId: "u-10",
    fromCity: "Москва",
    fromAddress: "м. Комсомольская",
    toCity: "Нижний Новгород",
    toAddress: "Московский вокзал",
    daysFromNow: -10,
    durationMinutes: 320,
    distanceKm: 420,
    price: 1100,
    seatsTotal: 4,
    status: "completed",
    tags: ["Тихая поездка"],
    bookings: [
      { passengerId: "u-16", seat: 1, status: "confirmed", comment: "Спасибо!" },
    ],
  },
  {
    id: "t-past-5",
    driverId: "u-11",
    fromCity: "Москва",
    fromAddress: "м. Юго-Западная",
    toCity: "Казань",
    toAddress: "Центр",
    daysFromNow: -14,
    durationMinutes: 520,
    distanceKm: 820,
    price: 1800,
    seatsTotal: 4,
    status: "completed",
    tags: ["С остановками", "Есть багаж"],
    bookings: [
      { passengerId: "u-22", seat: 1, status: "confirmed" },
      { passengerId: "u-17", seat: 2, status: "confirmed", comment: "Доехали отлично" },
    ],
  },
  // ── Будущие (active) ──
  {
    id: "t-1",
    driverId: "u-1",
    fromCity: "Москва",
    fromAddress: "м. Тёплый Стан",
    toCity: "Санкт-Петербург",
    toAddress: "м. Московская",
    daysFromNow: 3,
    durationMinutes: 470,
    distanceKm: 705,
    price: 1450,
    seatsTotal: 4,
    status: "active",
    tags: ["Есть багаж", "Тихая поездка"],
    comment: "Останавливаюсь один раз на заправке. В машине не курят.",
    bookings: [
      { passengerId: "u-3", seat: 1, status: "confirmed", comment: "Буду с рюкзаком." },
      { passengerId: "u-18", seat: 2, status: "pending", comment: "Возьмёте сумку 25 кг?" },
    ],
  },
  {
    id: "t-2",
    driverId: "u-2",
    fromCity: "Москва",
    fromAddress: "м. ВДНХ",
    toCity: "Ярославль",
    toAddress: "Ж/д вокзал Главный",
    daysFromNow: 5,
    durationMinutes: 210,
    distanceKm: 265,
    price: 750,
    seatsTotal: 3,
    status: "active",
    tags: ["Можно с животными", "Есть багаж"],
    comment: "Еду с небольшой собачкой в переноске.",
    bookings: [
      { passengerId: "u-4", seat: 2, status: "pending", comment: "Возьмете небольшую сумку?" },
    ],
  },
  {
    id: "t-3",
    driverId: "u-3",
    fromCity: "Нижний Новгород",
    fromAddress: "Московский вокзал",
    toCity: "Москва",
    toAddress: "м. Нижняя Масловка",
    daysFromNow: 2,
    durationMinutes: 320,
    distanceKm: 420,
    price: 1100,
    seatsTotal: 4,
    status: "active",
    tags: ["Только девушки", "С остановками"],
    comment: "Комфортный кроссовер, климат-контроль.",
    bookings: [
      { passengerId: "u-2", seat: 1, status: "confirmed", comment: "Отлично, едем!" },
      { passengerId: "u-14", seat: 2, status: "confirmed" },
    ],
  },
  {
    id: "t-4",
    driverId: "u-5",
    fromCity: "Москва",
    fromAddress: "м. Белорусская",
    toCity: "Тверь",
    toAddress: "Площадь Гагарина",
    daysFromNow: 1,
    durationMinutes: 130,
    distanceKm: 170,
    price: 500,
    seatsTotal: 3,
    status: "active",
    tags: ["Тихая поездка"],
    comment: "Выезжаю утром, успеваю к обеду.",
    bookings: [
      { passengerId: "u-16", seat: 1, status: "confirmed", comment: "Буду вовремя" },
      { passengerId: "u-19", seat: 2, status: "pending" },
    ],
  },
  {
    id: "t-5",
    driverId: "u-6",
    fromCity: "Москва",
    fromAddress: "м. Домодедовская",
    toCity: "Калуга",
    toAddress: "Автовокзал",
    daysFromNow: 4,
    durationMinutes: 160,
    distanceKm: 190,
    price: 550,
    seatsTotal: 4,
    status: "active",
    tags: ["Не курить", "Тихая поездка"],
    bookings: [
      { passengerId: "u-21", seat: 1, status: "confirmed" },
    ],
  },
  {
    id: "t-6",
    driverId: "u-8",
    fromCity: "Санкт-Петербург",
    fromAddress: "м. Московская",
    toCity: "Москва",
    toAddress: "м. Тёплый Стан",
    daysFromNow: 6,
    durationMinutes: 470,
    distanceKm: 705,
    price: 1500,
    seatsTotal: 4,
    status: "active",
    tags: ["Есть багаж", "Разговорчивый"],
    comment: "Выезжаю после обеда.",
    bookings: [
      { passengerId: "u-20", seat: 1, status: "pending" },
      { passengerId: "u-15", seat: 3, status: "pending" },
    ],
  },
  {
    id: "t-7",
    driverId: "u-10",
    fromCity: "Москва",
    fromAddress: "м. Комсомольская",
    toCity: "Нижний Новгород",
    toAddress: "Московский вокзал",
    daysFromNow: 8,
    durationMinutes: 320,
    distanceKm: 420,
    price: 1100,
    seatsTotal: 4,
    status: "active",
    tags: ["Тихая поездка"],
    bookings: [
      { passengerId: "u-14", seat: 1, status: "confirmed", comment: "Еду на поезд" },
      { passengerId: "u-18", seat: 2, status: "declined" },
    ],
  },
  {
    id: "t-8",
    driverId: "u-11",
    fromCity: "Москва",
    fromAddress: "м. Юго-Западная",
    toCity: "Казань",
    toAddress: "Центр",
    daysFromNow: 10,
    durationMinutes: 520,
    distanceKm: 820,
    price: 1800,
    seatsTotal: 4,
    status: "active",
    tags: ["С остановками", "Есть багаж"],
    comment: "Поеду по трассе М-12, комфортный темп.",
    bookings: [
      { passengerId: "u-22", seat: 1, status: "confirmed" },
      { passengerId: "u-4", seat: 2, status: "confirmed", comment: "Жду!" },
    ],
  },
  {
    id: "t-9",
    driverId: "u-13",
    fromCity: "Москва",
    fromAddress: "м. Алтуфьево",
    toCity: "Владимир",
    toAddress: "Вокзал",
    daysFromNow: 3,
    durationMinutes: 190,
    distanceKm: 190,
    price: 600,
    seatsTotal: 4,
    status: "active",
    tags: ["Можно с детьми"],
    comment: "Поездка на выходные, свободно 3 места.",
    bookings: [],
  },
  {
    id: "t-10",
    driverId: "u-7",
    fromCity: "Москва",
    fromAddress: "м. Митино",
    toCity: "Рязань",
    toAddress: "Центр",
    daysFromNow: 7,
    durationMinutes: 200,
    distanceKm: 200,
    price: 650,
    seatsTotal: 4,
    status: "active",
    tags: ["С остановками"],
    comment: "Выезжаю в пятницу вечером.",
    bookings: [
      { passengerId: "u-17", seat: 1, status: "pending", comment: "Можно с ребёнком?" },
    ],
  },
  {
    id: "t-11",
    driverId: "u-12",
    fromCity: "Тула",
    fromAddress: "Центр",
    toCity: "Москва",
    toAddress: "м. Калужская",
    daysFromNow: 2,
    durationMinutes: 140,
    distanceKm: 185,
    price: 600,
    seatsTotal: 4,
    status: "active",
    tags: ["Тихая поездка"],
    bookings: [
      { passengerId: "u-16", seat: 1, status: "confirmed" },
    ],
  },
  {
    id: "t-12",
    driverId: "u-1",
    fromCity: "Москва",
    fromAddress: "м. Саларьево",
    toCity: "Тула",
    toAddress: "Центр",
    daysFromNow: 9,
    durationMinutes: 140,
    distanceKm: 185,
    price: 650,
    seatsTotal: 4,
    status: "active",
    tags: ["Есть багаж"],
    comment: "Обычный рейс по субботам.",
    bookings: [],
  },
  {
    id: "t-13",
    driverId: "u-2",
    fromCity: "Ярославль",
    fromAddress: "Ж/д вокзал",
    toCity: "Москва",
    toAddress: "м. ВДНХ",
    daysFromNow: 12,
    durationMinutes: 210,
    distanceKm: 265,
    price: 750,
    seatsTotal: 3,
    status: "active",
    tags: ["Можно с животными"],
    bookings: [
      { passengerId: "u-15", seat: 1, status: "confirmed" },
      { passengerId: "u-20", seat: 2, status: "pending" },
    ],
  },
  {
    id: "t-14",
    driverId: "u-5",
    fromCity: "Москва",
    fromAddress: "м. Павелецкая",
    toCity: "Липецк",
    toAddress: "Центр",
    daysFromNow: 11,
    durationMinutes: 300,
    distanceKm: 470,
    price: 1400,
    seatsTotal: 3,
    status: "active",
    tags: ["Тихая поездка", "Не курить"],
    bookings: [],
  },
  {
    id: "t-15",
    driverId: "u-6",
    fromCity: "Калуга",
    fromAddress: "Автовокзал",
    toCity: "Москва",
    toAddress: "м. Тёплый Стан",
    daysFromNow: 5,
    durationMinutes: 160,
    distanceKm: 190,
    price: 550,
    seatsTotal: 4,
    status: "active",
    tags: ["Не курить"],
    bookings: [
      { passengerId: "u-21", seat: 1, status: "confirmed" },
      { passengerId: "u-18", seat: 2, status: "confirmed" },
    ],
  },
  {
    id: "t-16",
    driverId: "u-8",
    fromCity: "Москва",
    fromAddress: "м. Тёплый Стан",
    toCity: "Санкт-Петербург",
    toAddress: "м. Московская",
    daysFromNow: 15,
    durationMinutes: 470,
    distanceKm: 705,
    price: 1400,
    seatsTotal: 4,
    status: "active",
    tags: ["Разговорчивый", "Есть багаж"],
    bookings: [
      { passengerId: "u-19", seat: 1, status: "confirmed", comment: "С нетерпением жду!" },
    ],
  },
  {
    id: "t-17",
    driverId: "u-10",
    fromCity: "Нижний Новгород",
    fromAddress: "Московский вокзал",
    toCity: "Москва",
    toAddress: "м. Комсомольская",
    daysFromNow: 13,
    durationMinutes: 320,
    distanceKm: 420,
    price: 1100,
    seatsTotal: 4,
    status: "active",
    tags: ["Тихая поездка"],
    bookings: [],
  },
  {
    id: "t-18",
    driverId: "u-11",
    fromCity: "Казань",
    fromAddress: "Центр",
    toCity: "Москва",
    toAddress: "м. Юго-Западная",
    daysFromNow: 16,
    durationMinutes: 520,
    distanceKm: 820,
    price: 1800,
    seatsTotal: 4,
    status: "active",
    tags: ["С остановками"],
    bookings: [
      { passengerId: "u-22", seat: 1, status: "pending" },
    ],
  },
  {
    id: "t-19",
    driverId: "u-13",
    fromCity: "Владимир",
    fromAddress: "Вокзал",
    toCity: "Москва",
    toAddress: "м. Алтуфьево",
    daysFromNow: 17,
    durationMinutes: 190,
    distanceKm: 190,
    price: 600,
    seatsTotal: 4,
    status: "active",
    tags: ["Можно с детьми"],
    bookings: [
      { passengerId: "u-17", seat: 1, status: "confirmed" },
    ],
  },
  {
    id: "t-20",
    driverId: "u-7",
    fromCity: "Рязань",
    fromAddress: "Центр",
    toCity: "Москва",
    toAddress: "м. Митино",
    daysFromNow: 20,
    durationMinutes: 200,
    distanceKm: 200,
    price: 650,
    seatsTotal: 4,
    status: "active",
    tags: ["С остановками"],
    bookings: [],
  },
  {
    id: "t-21",
    driverId: "u-12",
    fromCity: "Москва",
    fromAddress: "м. Калужская",
    toCity: "Тула",
    toAddress: "Центр",
    daysFromNow: 18,
    durationMinutes: 140,
    distanceKm: 185,
    price: 600,
    seatsTotal: 4,
    status: "active",
    tags: ["Тихая поездка"],
    bookings: [
      { passengerId: "u-14", seat: 1, status: "pending" },
      { passengerId: "u-16", seat: 2, status: "confirmed" },
    ],
  },
  // ── Отменённые (cancelled) ──
  {
    id: "t-c-1",
    driverId: "u-3",
    fromCity: "Москва",
    fromAddress: "м. Курская",
    toCity: "Воронеж",
    toAddress: "Центр",
    daysFromNow: -1,
    durationMinutes: 340,
    distanceKm: 520,
    price: 1300,
    seatsTotal: 4,
    status: "cancelled",
    tags: ["С остановками"],
    comment: "Поездка отменена из-за погоды.",
    bookings: [
      { passengerId: "u-15", seat: 1, status: "declined" },
    ],
  },
  {
    id: "t-c-2",
    driverId: "u-5",
    fromCity: "Москва",
    fromAddress: "м. Белорусская",
    toCity: "Смоленск",
    toAddress: "Центр",
    daysFromNow: 4,
    durationMinutes: 270,
    distanceKm: 400,
    price: 900,
    seatsTotal: 3,
    status: "cancelled",
    tags: [],
    comment: "Отменил, планы изменились.",
    bookings: [],
  },
];

// ─────────────────────────────────────────────────────────────
// Отзывы
// ─────────────────────────────────────────────────────────────
const reviews: SeedReview[] = [
  {
    id: "r-1",
    authorId: "u-15",
    targetUserId: "u-1",
    targetRole: "driver",
    rating: 5,
    text: "Отличный водитель, доехали комфортно и точно в срок!",
    tripRoute: "Москва → Санкт-Петербург",
    tripId: "t-past-1",
  },
  {
    id: "r-2",
    authorId: "u-4",
    targetUserId: "u-2",
    targetRole: "driver",
    rating: 5,
    text: "Прекрасная поездка, очень приятный водитель.",
    tripRoute: "Москва → Ярославль",
    tripId: "t-past-2",
  },
  {
    id: "r-3",
    authorId: "u-19",
    targetUserId: "u-8",
    targetRole: "driver",
    rating: 5,
    text: "Анна — супер! Машина чистая, ехали быстро и безопасно.",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-4",
    authorId: "u-16",
    targetUserId: "u-10",
    targetRole: "driver",
    rating: 5,
    text: "Пунктуальный, выехали минута в минуту.",
    tripRoute: "Москва → Нижний Новгород",
    tripId: "t-past-4",
  },
  {
    id: "r-5",
    authorId: "u-22",
    targetUserId: "u-11",
    targetRole: "driver",
    rating: 4,
    text: "Хорошая поездка, единственное — одна остановка лишняя.",
    tripRoute: "Москва → Казань",
    tripId: "t-past-5",
  },
  {
    id: "r-6",
    authorId: "u-1",
    targetUserId: "u-4",
    targetRole: "passenger",
    rating: 5,
    text: "Елена — идеальный пассажир, вовремя и без проблем.",
    tripRoute: "Москва → Тула",
    tripId: "t-past-1",
  },
  {
    id: "r-7",
    authorId: "u-8",
    targetUserId: "u-19",
    targetRole: "passenger",
    rating: 5,
    text: "Дарья очень приятная, надеюсь увидимся ещё.",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-8",
    authorId: "u-8",
    targetUserId: "u-20",
    targetRole: "passenger",
    rating: 4,
    text: "Хороший пассажир, немного опоздал на встречу.",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-9",
    authorId: "u-11",
    targetUserId: "u-17",
    targetRole: "passenger",
    rating: 5,
    text: "Светлана с дочкой — очень воспитанные попутчики.",
    tripRoute: "Москва → Казань",
    tripId: "t-past-5",
  },
  {
    id: "r-10",
    authorId: "u-2",
    targetUserId: "u-4",
    targetRole: "passenger",
    rating: 5,
    text: "Наталья — тихая и аккуратная, рекомендую.",
    tripRoute: "Москва → Ярославль",
    tripId: "t-past-2",
  },
  {
    id: "r-11",
    authorId: "u-1",
    targetUserId: "u-15",
    targetRole: "passenger",
    rating: 5,
    text: "Приятный собеседник, в пути было интересно.",
    tripRoute: "Москва → Тула",
    tripId: "t-past-1",
  },
  {
    id: "r-12",
    authorId: "u-10",
    targetUserId: "u-16",
    targetRole: "passenger",
    rating: 4,
    text: "Нормальный пассажир, был с большой сумкой.",
    tripRoute: "Москва → Нижний Новгород",
    tripId: "t-past-4",
  },
  {
    id: "r-13",
    authorId: "u-4",
    targetUserId: "u-1",
    targetRole: "driver",
    rating: 5,
    text: "Илья водит очень плавно, дорога пролетела незаметно.",
    tripRoute: "Москва → Тула",
    tripId: "t-past-1",
  },
  {
    id: "r-14",
    authorId: "u-20",
    targetUserId: "u-8",
    targetRole: "driver",
    rating: 5,
    text: "Отличная машина, водитель профессионал.",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-15",
    authorId: "u-21",
    targetUserId: "u-8",
    targetRole: "driver",
    rating: 5,
    text: "Чудесная поездка, спасибо за компанию!",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-16",
    authorId: "u-17",
    targetUserId: "u-11",
    targetRole: "driver",
    rating: 5,
    text: "Татьяна — очень аккуратная, с детьми особенно ценно.",
    tripRoute: "Москва → Казань",
    tripId: "t-past-5",
  },
  {
    id: "r-17",
    authorId: "u-8",
    targetUserId: "u-21",
    targetRole: "passenger",
    rating: 5,
    text: "Ксения — пунктуальный и приятный пассажир.",
    tripRoute: "Санкт-Петербург → Москва",
    tripId: "t-past-3",
  },
  {
    id: "r-18",
    authorId: "u-11",
    targetUserId: "u-22",
    targetRole: "passenger",
    rating: 5,
    text: "Олег приехал вовремя и аккуратно относился к машине.",
    tripRoute: "Москва → Казань",
    tripId: "t-past-5",
  },
];

function validateSeedData(): void {
  const userIds = new Set(users.map((user) => user.id));
  const tripById = new Map(trips.map((trip) => [trip.id, trip]));
  const reviewKeys = new Set<string>();

  for (const trip of trips) {
    if (trip.seatsTotal < 1 || trip.seatsTotal > 4) {
      throw new Error(`Invalid seatsTotal for seed trip ${trip.id}`);
    }

    const activeSeats = new Set<number>();
    const activePassengers = new Set<string>();
    for (const booking of trip.bookings) {
      if (!userIds.has(booking.passengerId)) {
        throw new Error(`Unknown passenger ${booking.passengerId} in ${trip.id}`);
      }
      if (booking.seat < 1 || booking.seat > trip.seatsTotal) {
        throw new Error(`Invalid seat ${booking.seat} in ${trip.id}`);
      }
      if (booking.status === "pending" || booking.status === "confirmed") {
        if (activeSeats.has(booking.seat)) {
          throw new Error(`Duplicate active seat ${booking.seat} in ${trip.id}`);
        }
        if (activePassengers.has(booking.passengerId)) {
          throw new Error(`Duplicate active passenger ${booking.passengerId} in ${trip.id}`);
        }
        activeSeats.add(booking.seat);
        activePassengers.add(booking.passengerId);
      }
    }
  }

  for (const review of reviews) {
    const trip = review.tripId ? tripById.get(review.tripId) : undefined;
    if (!userIds.has(review.authorId) || !userIds.has(review.targetUserId)) {
      throw new Error(`Unknown user in seed review ${review.id}`);
    }
    if (!trip || review.authorId === review.targetUserId) {
      throw new Error(`Invalid trip or users in seed review ${review.id}`);
    }

    const confirmedPassengers = new Set(
      trip.bookings
        .filter((booking) => booking.status === "confirmed")
        .map((booking) => booking.passengerId)
    );
    const validDirection =
      review.targetRole === "driver"
        ? trip.driverId === review.targetUserId && confirmedPassengers.has(review.authorId)
        : review.authorId === trip.driverId && confirmedPassengers.has(review.targetUserId);
    if (!validDirection) {
      throw new Error(`Invalid review direction in seed review ${review.id}`);
    }

    const key = `${review.authorId}:${review.tripId}:${review.targetUserId}`;
    if (reviewKeys.has(key)) {
      throw new Error(`Duplicate seed review ${key}`);
    }
    reviewKeys.add(key);
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to reset a production database. Set ALLOW_PRODUCTION_SEED=true to override."
    );
  }

  validateSeedData();
  console.log("Seeding database with rich mock data...");

  // Clean old records
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.car.deleteMany();
  await prisma.user.deleteMany();

  // Create Users (with cars for drivers)
  for (const u of users) {
    await prisma.user.create({
      data: {
        id: u.id,
        vkUserId: u.vkUserId,
        name: u.name,
        avatar: u.avatar,
        rating: u.rating,
        reviewsCount: u.reviewsCount,
        tripsCount: u.tripsCount,
        isVerified: u.isVerified,
        notificationsEnabled: u.notificationsEnabled ?? true,
        verificationStatus: u.verificationStatus,
        verifiedAt: u.isVerified ? new Date(Date.now() - 60 * dayMs) : null,
        about: u.about,
        ...(u.car
          ? {
              car: {
                create: u.car,
              },
            }
          : {}),
      },
    });
  }

  // Create Trips + Bookings
  for (const t of trips) {
    const confirmedCount = t.bookings.filter((b) => b.status === "confirmed").length;
    await prisma.trip.create({
      data: {
        id: t.id,
        driverId: t.driverId,
        fromCity: t.fromCity,
        fromAddress: t.fromAddress,
        toCity: t.toCity,
        toAddress: t.toAddress,
        departureAt: new Date(Date.now() + t.daysFromNow * dayMs),
        durationMinutes: t.durationMinutes,
        distanceKm: t.distanceKm,
        price: t.price,
        seatsTotal: t.seatsTotal,
        seatsAvailable:
          t.status === "active" ? Math.max(0, t.seatsTotal - confirmedCount) : 0,
        status: t.status,
        tags: t.tags,
        comment: t.comment,
        bookings: {
          create: t.bookings.map((b) => ({
            passengerId: b.passengerId,
            seat: b.seat,
            status: b.status,
            comment: b.comment,
          })),
        },
      },
    });
  }

  // Create Reviews
  for (const r of reviews) {
    await prisma.review.create({
      data: {
        id: r.id,
        authorId: r.authorId,
        targetUserId: r.targetUserId,
        targetRole: r.targetRole,
        rating: r.rating,
        text: r.text,
        tripRoute: r.tripRoute,
        tripId: r.tripId,
      },
    });
  }

  const reviewAggregates = await prisma.review.groupBy({
    by: ["targetUserId"],
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const aggregate of reviewAggregates) {
    await prisma.user.update({
      where: { id: aggregate.targetUserId },
      data: {
        rating: aggregate._avg.rating ?? 5,
        reviewsCount: aggregate._count._all,
      },
    });
  }

  // Create Notifications
  const notifications = [
    {
      userId: "u-3",
      type: "booking_created",
      title: "Новая заявка на поездку",
      body: "Павел Никитин хочет присоединиться к вашей поездке Москва → Санкт-Петербург.",
      isRead: false,
    },
    {
      userId: "u-3",
      type: "booking_created",
      title: "Новая заявка на поездку",
      body: "Артём Киселёв хочет присоединиться к вашей поездке Москва → Санкт-Петербург.",
      isRead: false,
    },
    {
      userId: "u-4",
      type: "booking_confirmed",
      title: "Бронирование подтверждено",
      body: "Марина Ковалёва подтвердила вашу поездку Москва → Ярославль.",
      isRead: false,
    },
    {
      userId: "u-18",
      type: "booking_created",
      title: "Новая заявка на поездку",
      body: "Вы отправили заявку на поездку Москва → Санкт-Петербург.",
      isRead: true,
    },
    {
      userId: "u-16",
      type: "booking_confirmed",
      title: "Бронирование подтверждено",
      body: "Дмитрий Соколов подтвердил вашу поездку Москва → Тверь.",
      isRead: false,
    },
    {
      userId: "u-22",
      type: "booking_confirmed",
      title: "Бронирование подтверждено",
      body: "Татьяна Белова подтвердила вашу поездку Москва → Казань.",
      isRead: true,
    },
  ];
  for (const n of notifications) {
    await prisma.notification.create({ data: n });
  }

  const stats = {
    users: await prisma.user.count(),
    cars: await prisma.car.count(),
    trips: await prisma.trip.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
    notifications: await prisma.notification.count(),
  };
  console.log("Seeding rich mock data complete!", stats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
