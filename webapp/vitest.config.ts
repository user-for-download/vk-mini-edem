import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// webapp-тесты: node-окружение достаточно для чистых модулей (api-client,
// форматтеры). DOM-компоненты тестируются e2e (Playwright) — как в репо.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Как и в mini-app: контракты из исходников, без предварительной
      // сборки dist в packages/contracts.
      "@edem/contracts": path.resolve(
        __dirname,
        "../packages/contracts/src/index.ts"
      ),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
