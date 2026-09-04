// mini-app/src/onboarding/version.ts
// Версия слайдов онбординга.
//
// Поднимайте значение при каждом изменении набора слайдов: все пользователи
// увидят новый онбординг по одному разу (сравнение с версией, сохранённой
// на бэкенде в User.onboardingVersion).
//
// Константа вынесена из slides.ts намеренно: slides.ts загружается лениво
// (dynamic import), а статический импорт версии не должен тянуть
// base64-изображения в начальный бандл.
export const ONBOARDING_VERSION = "1";

/**
 * Нужно ли показывать онбординг: показываем, если пользователь ещё не видел
 * текущую версию слайдов (null/undefined — онбординг не проходил).
 */
export function shouldShowOnboarding(
  completedVersion: string | null | undefined,
): boolean {
  return completedVersion !== ONBOARDING_VERSION;
}
