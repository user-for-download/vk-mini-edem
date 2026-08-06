import { create } from "zustand";
import { bridge } from "@/helpers/bridge";
import type { User } from "@/types";
import { authApi } from "@/api/auth.api";
import { apiClient } from "@/api/client";

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

async function getVkAuthPayload(): Promise<{ searchParams: string }> {
  const search = window.location.search;
  const urlParams = new URLSearchParams(search);

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

  return { searchParams: search.replace(/^\?/, "") };
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
