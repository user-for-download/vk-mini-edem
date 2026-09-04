// mini-app/src/components/__tests__/AuthGate.test.tsx
//
// Рендер-тесты экрана бана без @testing-library/react (не установлен):
// используем react-dom/server renderToString — useEffect не выполняются,
// DOM не нужен. Стор мокаем: zustand v5 в SSR читает initial state через
// getServerSnapshot, поэтому реальным setState экраны не переключить;
// логика самого стора покрыта useAuthStore.test.ts. Здесь проверяем
// рендер-ветки AuthGate: плашка бана с причиной и кнопкой «Обратная связь».
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// AuthGate вызывает useModalApi — без ModalProvider хук бросается.
// Мокаем провайдер стабом: поведение модалки покрыто feedbackModal.test.ts.
vi.mock("@/providers/ModalProvider", () => ({
  useModalApi: () => ({ openCustomModalPage: vi.fn() }),
}));

// Управляемое состояние стора для рендер-веток AuthGate.
// vi.hoisted: фабрика vi.mock поднимается выше объявления переменных.
const { mockState } = vi.hoisted(() => ({
  mockState: {
    status: "idle",
    banReason: null,
    bootstrap: () => Promise.resolve(),
  } as Record<string, unknown>,
}));

vi.mock("@/store/useAuthStore", () => ({
  useAuthStore: Object.assign(
    (selector: (state: typeof mockState) => unknown) => selector(mockState),
    {
      getState: () => mockState,
      setState: () => undefined,
    },
  ),
}));

import { AuthGate } from "@/components/AuthGate";

describe("AuthGate — экран бана", () => {
  beforeEach(() => {
    mockState.status = "idle";
    mockState.banReason = null;
  });

  it("забаненный видит плашку «Аккаунт заблокирован», причину и кнопку «Обратная связь»", () => {
    // Arrange
    mockState.status = "banned";
    mockState.banReason = "Спам в чатах";

    // Act
    const html = renderToString(<AuthGate />);

    // Assert — SSR вставляет <!-- --> между «Причина:» и значением,
    // поэтому значение проверяем отдельно.
    expect(html).toContain("Аккаунт заблокирован");
    expect(html).toContain("Причина:");
    expect(html).toContain("Спам в чатах");
    expect(html).toContain("Обратная связь");
  });

  it("кнопки «Обновить» на экране бана больше нет", () => {
    // Arrange
    mockState.status = "banned";
    mockState.banReason = "Спам в чатах";

    // Act
    const html = renderToString(<AuthGate />);

    // Assert
    expect(html).not.toContain("Обновить");
  });

  it("старый бан без причины показывает «Причина не указана»", () => {
    // Arrange
    mockState.status = "banned";
    mockState.banReason = null;

    // Act
    const html = renderToString(<AuthGate />);

    // Assert
    expect(html).toContain("Аккаунт заблокирован");
    expect(html).toContain("Причина не указана");
  });

  it("во время refresh-полёта (initializing) показывает загрузку, а не экран логина", () => {
    // Arrange — возврат из фона: стор выставил initializing и летит refreshSession.
    mockState.status = "initializing";

    // Act
    const html = renderToString(<AuthGate />);

    // Assert — ни плашки логина, ни кнопки повтора: только загрузка.
    expect(html).not.toContain("Ошибка авторизации");
    expect(html).not.toContain("Попробовать снова");
    expect(html).not.toContain("Аккаунт заблокирован");
  });

  it("экран ошибки авторизации не изменился (не задет фичей)", () => {
    // Arrange
    mockState.status = "unauthenticated";

    // Act
    const html = renderToString(<AuthGate />);

    // Assert
    expect(html).toContain("Ошибка авторизации");
    expect(html).toContain("Попробовать снова");
  });
});
