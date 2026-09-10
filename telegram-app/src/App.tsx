import { useEffect } from "react";
import { miniApp } from "@telegram-apps/sdk-react";
import { AppConfig } from "@/AppConfig";
import { AppRouter } from "@/router/AppRouter";

export default function App() {
  useEffect(() => {
    // Сигнал WebView: контент готов к показу (убирает loading-скелетон Telegram).
    miniApp.ready.ifAvailable();
  }, []);

  return (
    <AppConfig>
      <AppRouter />
    </AppConfig>
  );
}
