// mini-app/src/onboarding/useOnboarding.ts
// Однократный показ онбординга (информационных слайдов VK) после первого входа.
//
// Флаг «онбординг пройден» хранится на бэкенде (User.onboardingVersion):
// админка может сбросить его для повторного показа, а поднятие
// ONBOARDING_VERSION заново показывает слайды всем пользователям.
//
// Любой исход — просмотр, пропуск, закрытие, недоступность метода — сохраняет
// версию через POST /users/me/onboarding: рекомендация VK не навязывать
// обучение повторно, если пользователь его пропустил или не завершил.
//
// Слайды загружаются лениво (dynamic import): base64-изображения не попадают
// в начальный бандл и подтягиваются только для новых пользователей.
import { useEffect } from "react";

import { usersApi } from "@/api/users.api";
import { showSlidesSheet } from "@/helpers/bridge";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ONBOARDING_VERSION, shouldShowOnboarding } from "./version";

// Защита от повторного запуска: StrictMode дублирует эффекты в dev,
// плюс онбординг не должен показываться дважды за сессию.
let onboardingTriggered = false;

export function useOnboarding(): void {
  // Хук вызывается в App, который рендерится внутри AuthGate: к моменту
  // монтирования bootstrap завершён и авторизованный пользователь в сторе.
  const user = useCurrentUser();

  useEffect(() => {
    if (onboardingTriggered) return;
    // Страховка на случай изменения порядка рендера: без пользователя
    // не стартуем и флаг не ставим — эффект перезапустится, когда
    // пользователь появится в сторе.
    if (!user) return;
    onboardingTriggered = true;

    if (!shouldShowOnboarding(user.onboardingVersion)) return;

    void (async () => {
      // Сбой загрузки чанка со слайдами — не сохраняем версию:
      // попытка повторится при следующем запуске приложения.
      let slides;
      try {
        ({ ONBOARDING_SLIDES: slides } = await import("./slides"));
      } catch {
        return;
      }

      await showSlidesSheet(slides);

      try {
        await usersApi.completeOnboarding(ONBOARDING_VERSION);
      } catch {
        // Ошибка сохранения не критична: версия останется несохранённой,
        // и слайды покажутся повторно при следующем запуске — допустимо.
      }
    })();
  }, [user]);
}
