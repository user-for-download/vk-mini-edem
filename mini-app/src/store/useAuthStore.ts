import { create } from "zustand";
import { bridge, getVkUserInfo } from "@/helpers/bridge";
import type { User } from "@/types";
import { authApi } from "@/api/auth.api";
import { ApiError, apiClient } from "@/api/client";
import type { AuthRequest, AuthResponse } from "@edem/contracts";

export type AuthStatus =
  | "idle"
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "error"
  | "background"
  | "banned";

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  /**
   * Причина бана (PII). null — бан без причины (старые баны) или бан ещё
   * не детектирован. Подбирается из 403-ответа бэкенда при bootstrap или
   * при refresh-403 через apiClient.onBanned. Не логируется.
   */
  banReason: string | null;
  /**
   * Launch-параметры VK (строка searchParams), с которыми открыт мини-апп.
   * Заполняются только при бане (applyBanned) — appeal забаненного
   * пользователя подписывается ими же (та же VK-подпись, что в /auth/vk).
   * В остальных состояниях null. Не логируются.
   */
  launchParams: string | null;
  bootstrap: () => Promise<void>;
  refreshSession: () => Promise<void>;
  handleBackgroundState: (isHidden: boolean) => void;
  clearSession: (reason?: string) => Promise<void>;
}

let bootstrapPromise: Promise<void> | null = null;
let refreshPromise: Promise<void> | null = null;

async function getVkAuthPayload(): Promise<AuthRequest> {
  const search = window.location.search;
  const urlParams = new URLSearchParams(search);

  // Dev-режим: launch-параметры VK недоступны, собираем dev-sign набор
  // (без профильных полей — профиль останется placeholder'ом).
  if (import.meta.env.DEV && !urlParams.has("vk_user_id")) {
    let devUserId = 100001;
    try {
      const userInfo = await bridge.send("VKWebAppGetUserInfo");
      if (userInfo?.id) devUserId = Number(userInfo.id);
    } catch {
      // ignore
    }

    const devParams = new URLSearchParams({
      vk_user_id: String(devUserId),
      vk_app_id: "0",
      vk_platform: "desktop_web",
      vk_ts: Math.floor(Date.now() / 1000).toString(),
      sign: "dev-sign",
    });
    return { searchParams: devParams.toString() };
  }

  // Прод: профильные данные (имя, фамилия, фото) достаём через VK Bridge
  // (VKWebAppGetUserInfo) и отправляем вместе с auth-payload — бэкенд
  // заполняет ими профиль. Данные только отображаемые (идентификация —
  // по подписанному vk_user_id). Вне VK-окружения bridge не отвечает —
  // нужен таймаут, иначе bootstrap() зависнет навсегда.
  const vkProfile = import.meta.env.DEV
    ? null
    : await Promise.race([
        getVkUserInfo(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

  const profileFields: Pick<AuthRequest, "firstName" | "lastName" | "photo"> =
    vkProfile
      ? {
          firstName: vkProfile.firstName,
          lastName: vkProfile.lastName,
          photo: vkProfile.photo,
        }
      : {};

  // Способ 1: параметры в URL (window.location.search) — стандартный случай
  if (urlParams.has("vk_user_id") && urlParams.has("sign")) {
    return {
      searchParams: search.replace(/^\?/, ""),
      ...profileFields,
    };
  }

  // Способ 2: параметры через VK Bridge (VKWebAppGetLaunchParams) —
  // VK может не передавать их в URL, а отдавать через событие bridge.
  // ВАЖНО: вне VK-окружения bridge.send() не отвечает — нужен таймаут,
  // иначе bootstrap() зависнет навсегда и AuthGate покажет вечный спиннер.
  try {
    const launchParams = (await Promise.race([
      bridge.send("VKWebAppGetLaunchParams"),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000)),
    ])) as Record<string, unknown> | undefined;

    if (launchParams && launchParams.vk_user_id && launchParams.sign) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(launchParams)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      return { searchParams: params.toString(), ...profileFields };
    }
  } catch {
    // ignore — вернём пустой searchParams ниже
  }

  throw new Error("VK launch parameters are unavailable");
}

/**
 * Обрабатывает 403 FORBIDDEN из bootstrap: пользователь забанен, нужно
 * показать плашку «Аккаунт заблокирован» с причиной из тела ответа.
 * banReason — PII, в лог не выводим. Возвращает true, если ошибка была
 * распознана как бан; иначе вызывающий код обрабатывает её как обычный сбой.
 */
function isBannedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403 && error.code === "FORBIDDEN";
}

function applyAuthenticated(set: (state: Partial<AuthState>) => void, response: AuthResponse) {
  apiClient.setSession(response);
  set({
    status: "authenticated",
    user: response.user as User,
    session: {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: Date.now() + response.expiresIn * 1000,
    },
    banReason: null,
    launchParams: null,
  });
}

function applyBanned(
  set: (state: Partial<AuthState>) => void,
  error: ApiError,
  launchParams: string | null,
) {
  console.error("[Auth] Bootstrap failed: account is banned");
  apiClient.setSession(null);
  set({
    status: "banned",
    user: null,
    session: null,
    banReason: error.banReason ?? null,
    launchParams,
  });
}

function applyUnauthenticated(set: (state: Partial<AuthState>) => void) {
  apiClient.setSession(null);
  set({
    status: "unauthenticated",
    user: null,
    session: null,
    launchParams: null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  session: null,
  banReason: null,
  launchParams: null,

  bootstrap: async () => {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    bootstrapPromise = (async () => {
      const currentStatus = get().status;

      if (currentStatus === "authenticated" || currentStatus === "initializing") {
        return;
      }

      set({ status: "initializing" });

      // Launch-параметры подбираем ДО попытки логина: при бане логин
      // отклоняется 403, но строка searchParams нужна для подписи appeal.
      let launchParams: string | null = null;

      try {
        const payload = await getVkAuthPayload();
        launchParams = payload.searchParams;
        const response = await authApi.loginWithVk(payload);
        applyAuthenticated(set, response);
      } catch (error) {
        if (isBannedError(error)) {
          applyBanned(set, error, launchParams);
          return;
        }
        console.error("[Auth] Bootstrap failed:", error);
        applyUnauthenticated(set);
      }
    })().finally(() => {
      bootstrapPromise = null;
    });

    return bootstrapPromise;
  },

  refreshSession: async () => {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async () => {
      const state = get();

      if (!state.session?.refreshToken) {
        await get().clearSession("No refresh token");
        return;
      }

      try {
        console.log("[Auth] Refreshing session...");

        // Локальная подписка на обновлённые токены: стор обновляет session
        // сам и не зависит от подписки AuthGate (её может не быть, если гейт
        // размонтирован). Подписка одноразовая — снимается в finally ниже.
        // Дублирующее обновление из AuthGate идемпотентно (те же значения).
        const unsubscribe = apiClient.onTokenUpdate((tokens) => {
          if (get().status === "unauthenticated" || get().status === "error") {
            return;
          }
          set({
            status: "authenticated",
            session: {
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              expiresAt: Date.now() + tokens.expiresIn * 1000,
            },
          });
        });

        try {
          // Единая точка refresh — apiClient.tryRefresh() (single-flight):
          // тот же путь, что и при 401/WS-сбое. Ротация токенов происходит
          // один раз.
          apiClient.setSession(state.session);

          const refreshResult = await apiClient.tryRefresh();

          if (refreshResult === "permanent-rejection") {
            // Бан (403 FORBIDDEN) идёт тем же путём: onBanned уже выставил
            // status="banned" — не затираем плашку бана логаутом.
            if (get().status === "banned") {
              return;
            }
            await get().clearSession("Refresh failed");
          } else if (refreshResult === "transient-failure") {
            // Транзиентный сбой (сеть/5xx/невалидный ответ): сессию НЕ
            // сбрасываем — следующий запрос повторит refresh и восстановится.
            // Возвращаем только активный статус; user/session не трогаем.
            if (get().status !== "banned") {
              set({ status: "authenticated" });
            }
          }
          // success: session уже обновлена через onTokenUpdate выше.
        } finally {
          unsubscribe();
        }
      } catch (error) {
        console.error("[Auth] Refresh failed:", error);
        if (get().status !== "banned") {
          set({ status: "authenticated" });
        }
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  },

  handleBackgroundState: (isHidden) => {
    const state = get();

    if (isHidden) {
      if (state.status === "authenticated") {
        console.log("[Auth] App going to background");
        set({ status: "background" });
      }
      return;
    }

    if (state.status === "background") {
      console.log("[Auth] App restored from background, validating session...");

      if (!state.session) {
        set({ status: "unauthenticated", user: null, session: null });
        return;
      }

      if (state.session.expiresAt < Date.now()) {
        set({ status: "initializing" });
        void get().refreshSession();
      } else {
        set({ status: "authenticated" });
      }
    }
  },

  clearSession: async (reason) => {
    console.log(`[Auth] Clearing session. Reason: ${reason}`);

    // In-flight refresh не должен воскресить сессию после логаута.
    apiClient.invalidatePendingRefresh();
    apiClient.setSession(null);

    set({
      status: "unauthenticated",
      user: null,
      session: null,
      banReason: null,
      launchParams: null,
    });
  },
}));
