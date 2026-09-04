import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as {
  version?: string;
};

export default defineConfig(({ mode }) => {
  // Разрешение production/development-условий в экспортах пакетов (React и др.)
  // зависит от process.env.NODE_ENV, а не от mode Vite. Амбиентный NODE_ENV=test
  // из CI заставлял собирать development-сборку React. Фиксируем его для продакшн-сборок.
  if (mode === "production" && process.env.NODE_ENV !== "production") {
    process.env.NODE_ENV = "production";
  }
  // Vite загружает значения для клиентского кода, но config должен прочитать их
  // явно. Переменные процесса имеют приоритет над mini-app/.env-файлами.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const apiTarget = env.VITE_API_TARGET ?? "http://127.0.0.1:3011";

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
        "@": path.resolve(import.meta.dirname, "./src"),
        "@edem/contracts": path.resolve(
          import.meta.dirname,
          "../packages/contracts/src/index.ts"
        ),
        "react": path.resolve(import.meta.dirname, "../node_modules/react"),
        "react-dom": path.resolve(import.meta.dirname, "../node_modules/react-dom"),
        // Vite 8 (Rolldown) резолвит mock по browser-полю (UMD) и из-за
        // «consistent CJS interop» отдаёт весь exports-объект как default
        // (default.default.send). Алиас на чистый ESM-вход исключает interop.
        "@vkontakte/vk-bridge-mock": path.resolve(
          import.meta.dirname,
          "../node_modules/@vkontakte/vk-bridge-mock/dist/index.es.js"
        ),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version ?? "0.1.0"),
    },
    build: {
      chunkSizeWarningLimit: 400,
      // Vite 8: Rolldown вместо Rollup. manualChunks (function-форма) deprecated —
      // используем codeSplitting.groups (приоритет: точные группы > общий vendor).
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                // VKUI + его транзитивные зависимости, чтобы чанк был самодостаточным
                name: "vkui-vendor",
                test: /node_modules\/(@vkontakte\/(vkui|icons|vkjs|vkui-date-fns-tz|vkui-floating-ui)|@floating-ui|@swc\/helpers|clsx)\//,
                priority: 20,
              },
              {
                // React + его зависимости (scheduler), чтобы чанк был самодостаточным
                name: "react-vendor",
                test: /node_modules\/(react|react-dom|scheduler)\//,
                priority: 20,
              },
              {
                name: "vendor",
                test: /node_modules\//,
              },
            ],
          },
        },
      },
    },
    server: {
      // Доступ через туннель/домен — иначе Vite блокирует запросы
      // с незнакомых Host-заголовков. Хосты задаются через ENV
      // (VITE_ALLOWED_HOSTS="a.fun,b.fun"), чтобы не попадать в паблик.
      allowedHosts: env.VITE_ALLOWED_HOSTS
        ? env.VITE_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean)
        : undefined,
      proxy: {
        "/api": {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
        },
      },
      hmr: env.DISABLE_HMR !== "true",
      watch: env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
