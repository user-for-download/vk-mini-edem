// mini-app/src/components/__tests__/ConsentGate.test.tsx
//
// Рендер-тесты блокирующего экрана согласия без @testing-library/react
// (не установлен): react-dom/server renderToString — useEffect не
// выполняются, DOM не нужен. Интерактив (клик «Принять» → POST →
// разблокировка) покрывается типами и ручным/e2e-прогоном; здесь
// проверяем ветки рендера: гейт до акцепта и пропуск после него.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// Пользователь управляется через мок useCurrentUser ( ConsentGate читает
// только его). usersApi мокаем, чтобы не тянуть apiClient (сеть/токены).
const { mockState, completeOnboarding } = vi.hoisted(() => ({
  mockState: { user: null as { onboardingVersion: string | null } | null },
  completeOnboarding: vi.fn(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockState.user,
}));

vi.mock("@/api/users.api", () => ({
  usersApi: { completeOnboarding },
}));

import { ConsentGate } from "@/components/ConsentGate";

const APP_MARKER = "app-content-marker";

function renderGate() {
  return renderToString(
    <ConsentGate>
      <div data-marker={APP_MARKER} />
    </ConsentGate>,
  );
}

describe("ConsentGate — экран согласия", () => {
  beforeEach(() => {
    mockState.user = null;
    completeOnboarding.mockReset();
  });

  it("новый пользователь (версия не сохранена) видит экран согласия, приложение не рендерится", () => {
    // Arrange
    mockState.user = { onboardingVersion: null };

    // Act
    const html = renderGate();

    // Assert
    expect(html).toContain("Принять и продолжить");
    expect(html).toContain("Пользовательское соглашение");
    expect(html).toContain("Политика конфиденциальности");
    expect(html).toContain("старше 14 лет");
    expect(html).not.toContain(APP_MARKER);
  });

  it("старая версия онбординга («1», до введения акцепта) снова требует согласия", () => {
    // Arrange
    mockState.user = { onboardingVersion: "1" };

    // Act
    const html = renderGate();

    // Assert
    expect(html).toContain("Принять и продолжить");
    expect(html).not.toContain(APP_MARKER);
  });

  it("принявший (текущая версия) попадает сразу в приложение", () => {
    // Arrange — версия совпадает с ONBOARDING_VERSION ("2").
    mockState.user = { onboardingVersion: "2" };

    // Act
    const html = renderGate();

    // Assert
    expect(html).toContain(APP_MARKER);
    expect(html).not.toContain("Принять и продолжить");
  });

  it("без пользователя гейт прозрачен (auth ещё не завершён)", () => {
    // Arrange
    mockState.user = null;

    // Act
    const html = renderGate();

    // Assert
    expect(html).toContain(APP_MARKER);
  });
});
