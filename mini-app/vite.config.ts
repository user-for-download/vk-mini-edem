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
              if (id.includes("@vkontakte/icons") || id.includes("@vkontakte/vkui")) {
                return "vkui-vendor";
              }
              if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) {
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
