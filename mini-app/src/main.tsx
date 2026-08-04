import React from "react";
import ReactDOM from "react-dom/client";
import vkBridge from "@vkontakte/vk-bridge";
import "@vkontakte/vkui/dist/vkui.css";
import "@/index.css";

import "@/helpers/sentry";

import { AppConfig } from "@/AppConfig";
import App from "@/App";
import { vkBridgeMock } from "@/helpers/vkBridgeMock";

// В dev режиме используем mock VK Bridge
if (import.meta.env.DEV) {
  console.log("[DEV] Using VK Bridge mock");
  // Заменяем методы vkBridge на mock
  Object.assign(vkBridge, vkBridgeMock);
}

// Инициализируем VK Mini App
vkBridge.send("VKWebAppInit");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppConfig>
      <App />
    </AppConfig>
  </React.StrictMode>,
);
