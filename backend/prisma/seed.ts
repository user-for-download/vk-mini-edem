// backend/prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with rich mock data...");

  // Clean old records
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.car.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const user1 = await prisma.user.create({
    data: {
      id: "u-1",
      vkUserId: 100001,
      name: "Илья Северов",
      avatar: "https://i.pravatar.cc/200?img=12",
      rating: 4.9,
      reviewsCount: 34,
      tripsCount: 58,
      isVerified: true,
      about: "За рулём 7 лет. Регулярно езжу между Москвой и СПб.",
      car: {
        create: {
          model: "Skoda Octavia",
          color: "белый",
          plate: "А 217 МК 78",
        },
      },
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: "u-2",
      vkUserId: 100002,
      name: "Марина Ковалёва",
      avatar: "https://i.pravatar.cc/200?img=32",
      rating: 4.8,
      reviewsCount: 21,
      tripsCount: 40,
      isVerified: true,
      about: "Люблю комфортные спокойные поездки.",
      car: {
        create: {
          model: "Kia Rio",
          color: "синий",
          plate: "В 804 ТР 777",
        },
      },
    },
  });

  const user3 = await prisma.user.create({
    data: {
      id: "u-3",
      vkUserId: 100003,
      name: "Алексей Громов",
      avatar: "https://i.pravatar.cc/200?img=60",
      rating: 5.0,
      reviewsCount: 15,
      tripsCount: 22,
      isVerified: true,
      about: "Езжу аккуратно, в машине есть кондиционер и хорошая музыка.",
      car: {
        create: {
          model: "Volkswagen Tiguan",
          color: "чёрный",
          plate: "Е 991 ЕЕ 199",
        },
      },
    },
  });

  const user4 = await prisma.user.create({
    data: {
      id: "u-4",
      vkUserId: 100004,
      name: "Елена Смирнова",
      avatar: "https://i.pravatar.cc/200?img=45",
      rating: 4.7,
      reviewsCount: 9,
      tripsCount: 14,
      isVerified: false,
      about: "Пассажир, часто езжу по делам в соседние города.",
    },
  });

  // Create Trips
  // Past trip (completed, for reviews)
  const tripPast = await prisma.trip.create({
    data: {
      id: "t-past",
      driverId: user1.id,
      fromCity: "Москва",
      fromAddress: "м. Калужская",
      toCity: "Тула",
      toAddress: "Центр",
      departureAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      durationMinutes: 140,
      distanceKm: 185,
      price: 650,
      seatsTotal: 4,
      seatsAvailable: 0,
      status: "completed",
      tags: JSON.stringify(["Тихая поездка", "С остановками"]),
      comment: "Отличная поездка в Тулу и обратно.",
    },
  });

  // Future active trips
  const trip1 = await prisma.trip.create({
    data: {
      id: "t-1",
      driverId: user1.id,
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Санкт-Петербург",
      toAddress: "м. Московская",
      departureAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // in 3 days
      durationMinutes: 470,
      distanceKm: 705,
      price: 1450,
      seatsTotal: 4,
      seatsAvailable: 2,
      tags: JSON.stringify(["Есть багаж", "Тихая поездка"]),
      comment: "Останавливаюсь один раз на заправке. В машине не курят.",
    },
  });

  const trip2 = await prisma.trip.create({
    data: {
      id: "t-2",
      driverId: user2.id,
      fromCity: "Москва",
      fromAddress: "м. ВДНХ",
      toCity: "Ярославль",
      toAddress: "Ж/д вокзал Главный",
      departureAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // in 5 days
      durationMinutes: 210,
      distanceKm: 265,
      price: 750,
      seatsTotal: 3,
      seatsAvailable: 1,
      tags: JSON.stringify(["Можно с животными", "Есть багаж"]),
      comment: "Еду с небольшой собачкой в переноске.",
    },
  });

  const trip3 = await prisma.trip.create({
    data: {
      id: "t-3",
      driverId: user3.id,
      fromCity: "Нижний Новгород",
      fromAddress: "Московский вокзал",
      toCity: "Москва",
      toAddress: "м. Нижняя Масловка",
      departureAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // in 2 days
      durationMinutes: 320,
      distanceKm: 420,
      price: 1100,
      seatsTotal: 4,
      seatsAvailable: 3,
      tags: JSON.stringify(["Только девушки", "С остановками"]),
      comment: "Комфортный кроссовер, климат-контроль.",
    },
  });

  // Create Bookings
  await prisma.booking.create({
    data: {
      id: "b-past",
      tripId: tripPast.id,
      passengerId: user4.id,
      seat: 1,
      status: "confirmed",
      comment: "Спасибо за поездку!",
    },
  });

  await prisma.booking.create({
    data: {
      id: "b-1",
      tripId: trip1.id,
      passengerId: user3.id,
      seat: 1,
      status: "confirmed",
      comment: "Буду с рюкзаком.",
    },
  });

  await prisma.booking.create({
    data: {
      id: "b-2",
      tripId: trip2.id,
      passengerId: user4.id,
      seat: 2,
      status: "pending",
      comment: "Возьмете небольшую сумку?",
    },
  });

  await prisma.booking.create({
    data: {
      id: "b-3",
      tripId: trip3.id,
      passengerId: user2.id,
      seat: 1,
      status: "confirmed",
      comment: "Отлично, едем!",
    },
  });

  // Create Reviews
  await prisma.review.create({
    data: {
      id: "r-1",
      authorId: user3.id,
      targetUserId: user1.id,
      targetRole: "driver",
      rating: 5,
      text: "Отличный водитель, доехали комфортно и точно в срок!",
      tripRoute: "Москва → Санкт-Петербург",
      tripId: tripPast.id,
    },
  });

  await prisma.review.create({
    data: {
      id: "r-2",
      authorId: user4.id,
      targetUserId: user2.id,
      targetRole: "driver",
      rating: 5,
      text: "Прекрасная поездка, очень приятный водитель.",
      tripRoute: "Москва → Ярославль",
      tripId: tripPast.id,
    },
  });

  console.log("Seeding rich mock data complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
