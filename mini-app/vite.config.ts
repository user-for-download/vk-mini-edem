import react from "@vitejs/plugin-react";
import path from "path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8")
) as {
  version?: string;
};

export default defineConfig(() => {
  return {
    plugins: [react()],
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
