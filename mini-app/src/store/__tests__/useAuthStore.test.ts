import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Мокаем authApi.loginWithVk — это сетевая граница стора. Мост (bridge) внутри
// getVkAuthPayload() использует dev-mock vk-bridge и работает автономно, его
// трогать не нужно: тестируем именно «как стор реагирует на результат сети».
vi.mock("@/api/auth.api", () => ({
  authApi: {
    loginWithVk: vi.fn(),
  },
}));

import { ApiError, apiClient } from "@/api/client";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/store/useAuthStore";
import type { AuthResponse } from "@edem/contracts";

const mockedLoginWithVk = vi.mocked(authApi.loginWithVk);

// getVkAuthPayload() читает window.location.search ДО вызова loginWithVk.
// Тесты идут в node-окружении (window нет), поэтому стабим window с
// валидными launch-параметрами: стор берёт URL-ветку напрямую, bridge
// не вызывается (в DEV import.meta.env.DEV === true → vkProfile = null).
const VK_LAUNCH_SEARCH =
  "?vk_user_id=100001&sign=dev-sign&vk_app_id=0&vk_ts=1700000000&vk_platform=desktop_web";

const validUser = {
  id: "user-1",
  name: "Test User",
  avatar: "https://example.com/avatar.png",
  rating: 5,
  reviewsCount: 0,
  tripsCount: 0,
};

const validAuthResponse: AuthResponse = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  expiresIn: 900,
  user: validUser,
};

function bannedError(banReason: string | null | undefined): ApiError {
  // Не передаём banReason, если хотим протестировать «поля нет» — тогда
  // конструктор ApiError положит undefined, и стор должен трактовать это
  // как «причина не указана» (banReason: null).
  return new ApiError("Account is banned", "FORBIDDEN", 403, undefined, banReason);
}

function resetStore() {
  useAuthStore.setState({
    status: "idle",
    user: null,
    session: null,
    banReason: null,
  });
  mockedLoginWithVk.mockReset();
}

describe("useAuthStore.bootstrap", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { search: VK_LAUNCH_SEARCH } });
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("успешный логин переводит статус в authenticated и заполняет user/session", async () => {
    // Arrange
    mockedLoginWithVk.mockResolvedValue(validAuthResponse);

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user).toEqual(validUser);
    expect(state.session?.accessToken).toBe("access-1");
    expect(state.session?.refreshToken).toBe("refresh-1");
    expect(state.banReason).toBeNull();
  });

  it("403 FORBIDDEN с banReason переводит в banned и сохраняет причину", async () => {
    // Arrange
    mockedLoginWithVk.mockRejectedValue(bannedError("Спам"));

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("banned");
    expect(state.banReason).toBe("Спам");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it("403 FORBIDDEN с banReason: null (старый бан) даёт banned и banReason === null", async () => {
    // Arrange
    mockedLoginWithVk.mockRejectedValue(bannedError(null));

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("banned");
    expect(state.banReason).toBeNull();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it("403 FORBIDDEN без поля banReason (undefined) трактуется как null", async () => {
    // Arrange — конструктор без последнего аргумента оставляет .banReason === undefined,
    // applyBanned() нормализует это в null через `error.banReason ?? null`.
    mockedLoginWithVk.mockRejectedValue(
      new ApiError("Account is banned", "FORBIDDEN", 403),
    );

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("banned");
    expect(state.banReason).toBeNull();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it("любой другой ApiError (например 500) даёт unauthenticated — поведение не изменилось", async () => {
    // Arrange
    mockedLoginWithVk.mockRejectedValue(
      new ApiError("Internal server error", "INTERNAL_ERROR", 500),
    );

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.banReason).toBeNull();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it("не-ApiError (например обычный Error) даёт unauthenticated — поведение не изменилось", async () => {
    // Arrange
    mockedLoginWithVk.mockRejectedValue(new Error("Network down"));

    // Act
    await useAuthStore.getState().bootstrap();

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.banReason).toBeNull();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });
});

describe("useAuthStore.refreshSession", () => {
  const authenticatedSession = {
    accessToken: "access-old",
    refreshToken: "refresh-old",
    expiresAt: Date.now() + 60_000,
  };

  function seedAuthenticated() {
    useAuthStore.setState({
      status: "authenticated",
      user: validUser,
      session: { ...authenticatedSession },
      banReason: null,
    });
  }

  beforeEach(() => {
    resetStore();
    seedAuthenticated();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    apiClient.setSession(null);
    apiClient.invalidatePendingRefresh();
    resetStore();
  });

  it("транзиентный сбой (сеть/5xx) НЕ разлогинивает: user/session сохранены", async () => {
    // Arrange — tryRefresh сообщает о транзиентной проблеме (сеть легла).
    vi.spyOn(apiClient, "tryRefresh").mockResolvedValue("transient-failure");

    // Act
    await useAuthStore.getState().refreshSession();

    // Assert — сессия на месте, пользователь не выкинут на экран логина.
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user).toEqual(validUser);
    expect(state.session?.accessToken).toBe("access-old");
    expect(state.session?.refreshToken).toBe("refresh-old");
  });

  it("транзиентный сбой из initializing возвращает authenticated (повторный запрос восстановится)", async () => {
    // Arrange — возврат из фона: handleBackgroundState выставил initializing.
    useAuthStore.setState({ status: "initializing" });
    vi.spyOn(apiClient, "tryRefresh").mockResolvedValue("transient-failure");

    // Act
    await useAuthStore.getState().refreshSession();

    // Assert — спиннер снят, но логаута нет; следующий запрос повторит refresh.
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.session?.refreshToken).toBe("refresh-old");
  });

  it("реальный 401 (permanent-rejection) разлогинивает: сессия сброшена", async () => {
    // Arrange — refresh-токен отозван/ротирован, бэкенд ответил 401.
    vi.spyOn(apiClient, "tryRefresh").mockResolvedValue("permanent-rejection");

    // Act
    await useAuthStore.getState().refreshSession();

    // Assert — явный логаут: пользователь увидит экран авторизации.
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });

  it("успешный refresh обновляет session стора без подписки AuthGate", async () => {
    // Arrange — настоящий tryRefresh: fetch отвечает свежими токенами.
    // Подписки AuthGate здесь нет — стор обновляется сам (локальный onTokenUpdate).
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        accessToken: "access-new",
        refreshToken: "refresh-new",
        expiresIn: 900,
        user: validUser,
      }),
    } as Response);

    // Act
    await useAuthStore.getState().refreshSession();

    // Assert — токены ротированы, статус активный.
    const state = useAuthStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.session?.accessToken).toBe("access-new");
    expect(state.session?.refreshToken).toBe("refresh-new");
    expect(state.user).toEqual(validUser);
  });
});

describe("useAuthStore.clearSession", () => {
  beforeEach(() => {
    vi.stubGlobal("window", { location: { search: VK_LAUNCH_SEARCH } });
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("сбрасывает status, user, session и banReason в дефолтные значения", async () => {
    // Arrange — заранее приведём стор в «забаненное» состояние, чтобы проверить,
    // что clearSession() чистит именно banReason (а не оставляет его «прилипшим»).
    useAuthStore.setState({
      status: "banned",
      user: null,
      session: null,
      banReason: "Спам",
    });

    // Act
    await useAuthStore.getState().clearSession("test logout");

    // Assert
    const state = useAuthStore.getState();
    expect(state.status).toBe("unauthenticated");
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.banReason).toBeNull();
  });
});
