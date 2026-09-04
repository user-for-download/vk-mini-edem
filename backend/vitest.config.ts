import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Контракты резолвятся на ИСХОДНИКИ, а не на dist: собранный артефакт
// протухает, если забыть пересобрать contracts, и тесты начинают проверять
// старую схему (маскируя реальные расхождения, как в CI-инциденте с MAX_SEATS).
export default defineConfig({
  resolve: {
    alias: {
      "@edem/contracts": fileURLToPath(
        new URL("../packages/contracts/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    globals: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Тест-файлы делят одну БД (edem_test): параллельный запуск файлов
    // приводит к пересечению cleanDb и данных интеграционных тестов.
    fileParallelism: false,
  },
});
