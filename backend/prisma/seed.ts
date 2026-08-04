import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

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

  // Create Trips
  const trip1 = await prisma.trip.create({
    data: {
      id: "t-1",
      driverId: user1.id,
      fromCity: "Москва",
      fromAddress: "м. Тёплый Стан",
      toCity: "Санкт-Петербург",
      toAddress: "м. Московская",
      departureAt: new Date("2025-08-10T09:30:00Z"),
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
      departureAt: new Date("2025-08-10T14:00:00Z"),
      durationMinutes: 210,
      distanceKm: 265,
      price: 750,
      seatsTotal: 3,
      seatsAvailable: 1,
      tags: JSON.stringify(["Можно с животными", "Есть багаж"]),
      comment: "Еду с небольшой собачкой в переноске.",
    },
  });

  // Create Bookings
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
      passengerId: user3.id,
      seat: 1,
      status: "confirmed",
      comment: "Тестовая поездка для отзыва.",
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
      tripId: trip1.id,
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
