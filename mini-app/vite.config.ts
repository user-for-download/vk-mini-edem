import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as {
  version?: string;
};

// Таргет прокси для /api (включая /api/v1/ws). Прод-бэкенд слушает 3000, dev — свой порт
// (например 3011). Задаётся через ENV, чтобы не хардкодить окружение.
const apiTarget = process.env.VITE_API_TARGET ?? "http://127.0.0.1:3011";

export default defineConfig(() => {
  return {
    // Относительные пути ассетов: приложение может открываться с подпапкой
    // или хешем в URL (VK Mini App, reverse proxy). Абсолютные /assets/... сломаются.
    base: './',
    plugins: [
      react(),
      // PWA отключён для VK Mini App: Service Worker кэширует старую версию
      // приложения и конфликтует с деплоем (URL меняется при каждом обновлении).
      // В WebView VK офлайн-сценарий не критичен, а риски белого экрана — критичны.
    ],
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@edem/contracts": path.resolve(
          __dirname,
          "../packages/contracts/src/index.ts"
        ),
        "react": path.resolve(__dirname, "../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version ?? "0.1.0"),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              // VKUI + его транзитивные зависимости, чтобы чанк был самодостаточным
              if (
                id.includes("@vkontakte/vkui") ||
                id.includes("@vkontakte/icons") ||
                id.includes("@vkontakte/vkjs") ||
                id.includes("@vkontakte/vkui-date-fns-tz") ||
                id.includes("@vkontakte/vkui-floating-ui") ||
                id.includes("@floating-ui") ||
                id.includes("/@swc/helpers") ||
                id.includes("/clsx/")
              ) {
                return "vkui-vendor";
              }
              // React + его зависимости (scheduler), чтобы чанк был самодостаточным
              if (
                id.includes("/node_modules/react/") ||
                id.includes("/node_modules/react-dom/") ||
                id.includes("/node_modules/scheduler/")
              ) {
                return "react-vendor";
              }
              return "vendor";
            }
          },
        },
      },
    },
    server: {
      // Доступ через туннель/домен — иначе Vite блокирует запросы
      // с незнакомых Host-заголовков. Хосты задаются через ENV
      // (VITE_ALLOWED_HOSTS="a.fun,b.fun"), чтобы не попадать в паблик.
      allowedHosts: process.env.VITE_ALLOWED_HOSTS
        ? process.env.VITE_ALLOWED_HOSTS.split(",").map((h) => h.trim())
        : undefined,
      proxy: {
        "/api": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
