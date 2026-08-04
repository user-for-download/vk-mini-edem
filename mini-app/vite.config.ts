import tailwindcss from "@tailwindcss/vite";
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
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@edem/contracts": path.resolve(
          __dirname,
          "../packages/contracts/src/index.ts"
        ),
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
              if (id.includes("react")) {
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
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
