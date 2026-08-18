import { create } from "zustand";
import { bridge, getVkUserInfo } from "@/helpers/bridge";
import type { User } from "@/types";
import { authApi } from "@/api/auth.api";
import { apiClient } from "@/api/client";
import type { AuthRequest } from "@edem/contracts";

export type AuthStatus =
  | "idle"
  | "initializing"
  | "authenticated"
  | "unauthenticated"
  | "error"
  | "background";

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
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

  // Dev-режим: не автозаполняем ФИО/аватар и не проставляем isVerified —
  // профильная синхронизация через VKWebAppGetUserInfo выполняется только в проде.
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

  // Прод: при первом запуске получаем информацию о пользователе из VK
  // (имя, фамилия, аватар) и автоматически валидируем профиль этими данными.
  const vkProfile = import.meta.env.DEV ? null : await getVkUserInfo();
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

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "idle",
  user: null,
  session: null,

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

      try {
        const payload = await getVkAuthPayload();

        const response = await authApi.loginWithVk(payload);

        apiClient.setToken(response.accessToken);
        apiClient.setRefreshToken(response.refreshToken);

        set({
          status: "authenticated",
          user: response.user as User,
          session: {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: Date.now() + response.expiresIn * 1000,
          },
        });
      } catch (error) {
        console.error("[Auth] Bootstrap failed:", error);
        apiClient.setToken(null);
        apiClient.setRefreshToken(null);

        set({
          status: "unauthenticated",
          user: null,
          session: null,
        });
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

        // Единая точка refresh — apiClient.tryRefresh() (single-flight):
        // тот же путь, что и при 401/WS-сбое. Ротация токенов происходит
        // один раз; store обновляется через onTokenUpdate (AuthGate).
        apiClient.setToken(state.session.accessToken);
        apiClient.setRefreshToken(state.session.refreshToken);

        const refreshed = await apiClient.tryRefresh();

        if (!refreshed) {
          await get().clearSession("Refresh failed");
        }
      } catch (error) {
        console.error("[Auth] Refresh failed:", error);
        await get().clearSession("Refresh failed");
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
    apiClient.setToken(null);
    apiClient.setRefreshToken(null);

    set({
      status: "unauthenticated",
      user: null,
      session: null,
    });
  },
}));
