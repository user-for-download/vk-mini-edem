import { create } from "zustand";
import { parseURLSearchParamsForGetLaunchParams } from "@vkontakte/vk-bridge";
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

type VkLaunchParams = ReturnType<typeof parseURLSearchParamsForGetLaunchParams> & {
  vk_sign?: string;
};

let bootstrapPromise: Promise<void> | null = null;
let refreshPromise: Promise<void> | null = null;

async function getVkAuthPayload(): Promise<{ vkUserId: number; sign: string; ts: number }> {
  const launchParams = parseURLSearchParamsForGetLaunchParams(
    window.location.search
  ) as VkLaunchParams;

  let vkUserId = Number(launchParams.vk_user_id);

  const ts = Date.now();

  let sign: string;
  if (launchParams.vk_sign) {
    sign = launchParams.vk_sign;
  } else if (import.meta.env.DEV) {
    sign = "dev-sign";
  } else {
    throw new Error("VK sign is missing");
  }

  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    try {
      const userInfo = await bridge.send("VKWebAppGetUserInfo");
      vkUserId = Number(userInfo.id);
    } catch {
      // ignore
    }
  }

  if (!Number.isFinite(vkUserId) || vkUserId <= 0) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Auth] DEV fallback: vkUserId not available, using mock 100001"
      );
      vkUserId = 100001;
    } else {
      throw new Error(
        "Не удалось получить идентификатор пользователя ВКонтакте"
      );
    }
  }

  return {
    vkUserId,
    sign,
    ts,
  };
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
        const { vkUserId, sign, ts } = await getVkAuthPayload();

        const response = await authApi.loginWithVk({
          vkUserId,
          sign,
          ts,
        });

        apiClient.setToken(response.accessToken);

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

        const response = await authApi.refreshToken({
          refreshToken: state.session.refreshToken,
        });

        apiClient.setToken(response.accessToken);

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

    apiClient.setToken(null);

    set({
      status: "unauthenticated",
      user: null,
      session: null,
    });
  },
}));
