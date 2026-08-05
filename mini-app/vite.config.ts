import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as {
  version?: string;
};

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "Едем — попутчики",
          short_name: "Едем",
          description: "Поиск попутчиков и совместные поездки",
          theme_color: "#0077ff",
          background_color: "#ffffff",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          runtimeCaching: [
            // Публичный список поездок (GET без авторизации) — офлайн-доступ к
            // ранее загруженным результатам поиска. Авторизованные эндпоинты
            // намеренно НЕ кэшируются: в общем браузере кэш может отдать
            // данные другого пользователя.
            {
              urlPattern: /\/api\/v1\/trips(\?|$)/,
              handler: "NetworkFirst",
              method: "GET",
              options: {
                cacheName: "api-get-cache",
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60,
                },
              },
            },
            {
              urlPattern: /^https:\/\/i\.pravatar\.cc\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "avatars",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
          ],
        },
      }),
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
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        "/ws": {
          target: "ws://127.0.0.1:3001",
          ws: true,
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
