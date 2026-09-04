// Prisma 7 CLI-конфигурация (заменяет `datasource.url` в схеме и `prisma.seed`).
// Читается ВСЕМИ командами prisma CLI (generate, validate, migrate, db push...).
//
// Prisma 7 НЕ подгружает .env автоматически — загружаем backend/.env явно,
// путём относительно этого файла (а не CWD), чтобы конфиг работал из любой
// директории. В Docker/CI .env нет — переменные приходят из окружения.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: new URL("./.env", import.meta.url) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Фолбэк-заполнитель: `prisma generate` не требует реальной БД
    // (например, при сборке Docker-образа без окружения). Все команды,
    // обращающиеся к БД (migrate / db push), всегда имеют настоящий
    // DATABASE_URL из окружения (dev .env / CI / docker-compose).
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
