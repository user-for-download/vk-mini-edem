import React from "react";
import ReactDOM from "react-dom/client";
import "@vkontakte/vkui/dist/vkui.css";
import "@/index.css";
import "@/helpers/sentry";
import { AppConfig } from "@/AppConfig";
import App from "@/App";
import { bridge } from "@/helpers/bridge";

// Инициализируем VK Mini App (fire-and-forget, как в официальном примере VK).
// VKWebAppInit не должен блокировать рендер: вне VK-окружения bridge не может
// ответить, и await привёл бы к вечному белому экрану.
bridge.send("VKWebAppInit").catch((error) => {
  console.warn("[Bridge] VKWebAppInit failed:", error);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppConfig>
      <App />
    </AppConfig>
  </React.StrictMode>,
);
