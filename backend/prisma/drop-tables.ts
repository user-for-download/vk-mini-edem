import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Prisma 7 больше не подгружает .env автоматически — путь относительно файла.
loadEnv({ path: new URL("../.env", import.meta.url) });

// Prod-guard (зеркалит seed.ts: NODE_ENV=production + явный allow-флаг).
// Стоит ДО создания PrismaClient — выход происходит до любого
// подключения к БД и до любого SQL. Dev-flow не требует лишних флагов.
if (
  process.env.NODE_ENV === "production" &&
  process.env.ALLOW_PRODUCTION_DROP_TABLES !== "true"
) {
  throw new Error(
    "[drop-tables] Refusing to drop tables in production. Set ALLOW_PRODUCTION_DROP_TABLES=true to override.",
  );
}

if (!process.env.DATABASE_URL) {
  throw new Error("[drop-tables] DATABASE_URL не задан (backend/.env)");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  console.log("Dropping public schema completely...");
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE;`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public;`);
  console.log("Public schema recreated successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
