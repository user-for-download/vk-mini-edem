import { defineConfig } from "vitest/config";

export default defineConfig({
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
