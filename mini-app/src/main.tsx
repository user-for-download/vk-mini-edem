import React from "react";
import ReactDOM from "react-dom/client";
import "@vkontakte/vkui/dist/vkui.css";
import "@/index.css";
import "@/helpers/sentry";
import { AppConfig } from "@/AppConfig";
import App from "@/App";
import { bridge } from "@/helpers/bridge";

// Инициализируем VK Mini App
bridge.send("VKWebAppInit");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppConfig>
      <App />
    </AppConfig>
  </React.StrictMode>,
);
