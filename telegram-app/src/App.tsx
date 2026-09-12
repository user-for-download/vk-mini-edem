import { useEffect } from "react";
import { signalAppReady } from "@/utils/telegram-adapter";
import { AppConfig } from "@/AppConfig";
import { AppRouter } from "@/router/AppRouter";

export default function App() {
  useEffect(() => {
    // Сигнал WebView: контент готов к показу (убирает loading-скелетон Telegram).
    signalAppReady();
  }, []);

  return (
    <AppConfig>
      <AppRouter />
    </AppConfig>
  );
}
