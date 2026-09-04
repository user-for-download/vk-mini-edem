import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Как и в mini-app: резолвим контракты из исходников, чтобы webapp
      // собирался без предварительной сборки dist в packages/contracts.
      "@edem/contracts": path.resolve(
        __dirname,
        "../packages/contracts/src/index.ts"
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  server: {
    // Админка проксируется на admin.site.com; порт фиксирован (3013).
    port: 3013,
    // Слушаем все интерфейсы: доступ из сети / через внешний прокси.
    host: true,
    // Пускать запросы с любым Host (admin.site.com через прокси, туннели).
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3011",
        changeOrigin: true,
      },
    },
  },
});
