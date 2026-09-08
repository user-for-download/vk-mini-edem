// backend/prisma/seed-cities.ts
//
// Cities-only сид для PRODUCTION: наполняет справочник точек (25 городов
// Вологодской области) без демо-данных. Полный `db:seed` (users/trips/
// bookings) — только для dev/test окружений.
//
// Свойства:
// - идемпотентен: повторный запуск не создаёт дубли и не трогает
//   админские города (поиск по `nameNormalized`, см. seed.ts);
// - БЕЗОПАСЕН для прода: никогда не переписывает PK существующей строки.
//   В dev-сиде `seedCities()` реалайнит id на детерминированный v5
//   (наследие сломанных slug-id), но перед этим main() сносит ВСЕ строки,
//   ссылающиеся на City. В проде поездки/заявки реальные — перепись PK
//   порвала бы FK (ON DELETE SET NULL не спасает при UPDATE), поэтому
//   расхождение id только логируется;
// - свежая БД: все 25 городов создаются с детерминированными UUID v5
//   (seedCityId) — контракт `createTripDtoSchema` требует uuid.
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedCityId } from "./seed-ids.js";

// Prisma 7 не подгружает .env автоматически — путь относительно файла.
// В Docker/CI переменная уже в окружении, dotenv её не перезапишет.
loadEnv({ path: new URL("../.env", import.meta.url) });

if (!process.env.DATABASE_URL) {
  throw new Error("[seed-cities] DATABASE_URL не задан (backend/.env или окружение)");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Канонический список населённых пунктов (копия SEED_CITIES из seed.ts —
 * прод-сид не тянет демо-модуль целиком). Расширяется админом через
 * webapp-панель (`/cities`); порядок не критичен — сервер сортирует.
 */
const PROD_CITIES: readonly string[] = [
  "Бабаево",
  "Белозерск",
  "Великий Устюг",
  "Верховажье",
  "Вожега",
  "Вологда",
  "Вохтога",
  "Вытегра",
  "Грязовец",
  "Кадуй",
  "Кириллов",
  "Кичменгский Городок",
  "Красавино",
  "Молочное",
  "Никольск",
  "Сокол",
  "Суда",
  "Тарногский Городок",
  "Тотьма",
  "Устюжна",
  "Федотово",
  "Харовск",
  "Чагода",
  "Череповец",
  "Шексна",
];

/** Нормализация имени города: trim + схлопывание пробелов + lower-case. */
const normalizeCityName = (raw: string): string =>
  raw.trim().replace(/\s+/g, " ").toLowerCase();

async function seedCities(): Promise<void> {
  let created = 0;
  let renamed = 0;
  let untouched = 0;

  for (const name of PROD_CITIES) {
    const trimmed = name.trim().replace(/\s+/g, " ");
    const nameNormalized = normalizeCityName(name);

    const existing = await prisma.city.findFirst({ where: { nameNormalized } });
    if (existing) {
      // Только каноничное имя; PK (id) НЕ трогаем — см. шапку файла.
      if (existing.name !== trimmed) {
        await prisma.city.update({
          where: { id: existing.id },
          data: { name: trimmed },
        });
        renamed++;
      } else {
        untouched++;
      }
      if (existing.id !== seedCityId(nameNormalized)) {
        console.warn(
          `[seed-cities] город «${trimmed}» имеет id ${existing.id} ` +
            `(не детерминированный v5) — оставлен как есть (FK-безопасность)`,
        );
      }
      continue;
    }

    await prisma.city.create({
      data: {
        id: seedCityId(nameNormalized),
        name: trimmed,
        nameNormalized,
      },
    });
    created++;
  }

  console.info(
    `[seed-cities] готово: создано ${created}, переименовано ${renamed}, ` +
      `без изменений ${untouched} (всего в справочнике ${PROD_CITIES.length})`,
  );
}

seedCities()
  .catch((error) => {
    console.error("[seed-cities] провал:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
