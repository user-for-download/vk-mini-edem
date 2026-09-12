// backend/prisma/seed-cities.ts
//
// Prod-safe сид СПРАВОЧНИКА ГОРОДОВ (и только его).
//
// В отличие от seed.ts (dev: вайпает таблицы, льёт мок-юзеров/поездки
// и отказывается работать в production без ALLOW_PRODUCTION_SEED):
// - идемпотентен: создаёт только ОТСУТСТВУЮЩИЕ города из канонического
//   списка (cities-data.ts); существующие строки НЕ трогает
//   (ни rename, ни realign id — это делает dev-seedCities на dev-БД);
// - остальные таблицы не читает и не пишет;
// - в production работать РАЗРЕШЕНО (для этого и создан).
//
// Зачем: создание поездок требует fromCityId/toCityId из справочника,
// на пустой прод-БД без городов публиковать поездки нельзя.
//
// Использование (DATABASE_URL обязателен):
//   DATABASE_URL=postgresql://... npx tsx prisma/seed-cities.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { SEED_CITIES, normalizeCityName } from "./cities-data.js";
import { seedCityId } from "./seed-ids.js";

// Prisma 7 больше не подгружает .env автоматически — путь относительно файла.
loadEnv({ path: new URL("../.env", import.meta.url) });

if (!process.env.DATABASE_URL) {
  throw new Error("[seed-cities] DATABASE_URL не задан");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main(): Promise<void> {
  let created = 0;
  let existed = 0;
  for (const rawName of SEED_CITIES) {
    const name = rawName.trim().replace(/\s+/g, " ");
    const nameNormalized = normalizeCityName(rawName);
    const existing = await prisma.city.findFirst({ where: { nameNormalized } });
    if (existing) {
      existed += 1;
      continue;
    }
    await prisma.city.create({
      data: { id: seedCityId(nameNormalized), name, nameNormalized },
    });
    created += 1;
  }
  console.log(`[seed-cities] created=${created} existed=${existed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
