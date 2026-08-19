import vkBridge from "@vkontakte/vk-bridge";
import vkBridgeMock from "@vkontakte/vk-bridge-mock";

const customBridgeMock = new Proxy(vkBridgeMock, {
  get(target, prop, receiver) {
    if (prop === "send") {
      return async (method: string, props?: unknown) => {
        if (method === "VKWebAppGetUserInfo") {
          return {
            id: 100001,
            first_name: "Илья",
            last_name: "Северов",
            photo_200: "https://i.pravatar.cc/200?img=12",
            photo_100: "https://i.pravatar.cc/100?img=12",
            sex: 2,
            city: { id: 1, title: "Москва" },
            country: { id: 1, title: "Россия" },
          };
        }
        if (method === "VKWebAppGetLaunchParams") {
          return {
            vk_user_id: 100001,
            vk_app_id: 0,
            vk_platform: "desktop_web",
            vk_is_app_user: 1,
            vk_are_notifications_enabled: 1,
            vk_language: "ru",
            vk_ref: "other",
            vk_access_token_settings: "",
            vk_sign: "dev-sign",
            vk_ts: Math.floor(Date.now() / 1000),
            sign: "dev-sign",
          };
        }
        // Проброс в mock: сигнатура vk-bridge слишком узкая для произвольных строк
        return vkBridgeMock.send(
          method as Parameters<typeof vkBridgeMock.send>[0],
          props as Parameters<typeof vkBridgeMock.send>[1],
        );
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const bridge = import.meta.env.DEV
  ? (customBridgeMock as unknown as typeof vkBridge)
  : vkBridge;

/**
 * Профильные данные пользователя из VK (VKWebAppGetUserInfo).
 * В dev-режиме не используется для автозаполнения ФИО/аватара —
 * синхронизация профиля выполняется только в продакшене.
 */
export interface VkUserInfo {
  id: number;
  firstName?: string;
  lastName?: string;
  photo?: string;
}

export type BridgeActionResult = "success" | "unsupported" | "cancelled" | "failed";

async function supports(method: Parameters<typeof vkBridge.supportsAsync>[0]): Promise<boolean> {
  try {
    return await bridge.supportsAsync(method);
  } catch {
    return false;
  }
}

function isCancelledBridgeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const data = "error_data" in error ? error.error_data : null;
  return Boolean(
    data &&
      typeof data === "object" &&
      "error_reason" in data &&
      String(data.error_reason).toLowerCase().includes("cancel"),
  );
}

export async function getVkUserInfo(): Promise<VkUserInfo | null> {
  try {
    const data = (await bridge.send(
      "VKWebAppGetUserInfo"
    )) as Record<string, unknown> | null;
    if (!data || typeof data.id !== "number") {
      return null;
    }
    return {
      id: data.id,
      firstName:
        typeof data.first_name === "string" ? data.first_name : undefined,
      lastName:
        typeof data.last_name === "string" ? data.last_name : undefined,
      photo: typeof data.photo_200 === "string" ? data.photo_200 : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Запрашивает у пользователя разрешение на отправку сообщений
 * от имени сообщества (VKWebAppAllowMessagesFromGroup).
 * Без этого согласия VK API messages.send вернёт ошибку
 * "Can't send messages for users without permission".
 *
 * Вызывается только в продакшене (в dev пропускаем), результат не критичен.
 * В качестве key используем VK ID пользователя (из VKWebAppGetUserInfo).
 */
export async function requestVkMessagesPermission(groupId: number): Promise<BridgeActionResult> {
  if (import.meta.env.DEV) {
    return "unsupported";
  }
  try {
    if (!(await supports("VKWebAppAllowMessagesFromGroup"))) {
      return "unsupported";
    }
    const userInfo = await getVkUserInfo();
    if (!userInfo) return "failed";
    const data = (await bridge.send("VKWebAppAllowMessagesFromGroup", {
      group_id: groupId,
      key: String(userInfo.id),
    })) as { result?: boolean } | null;
    return data?.result === true ? "success" : "cancelled";
  } catch (error) {
    return isCancelledBridgeError(error) ? "cancelled" : "failed";
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  const openUrlMethod = "VKWebAppOpenUrl" as Parameters<typeof vkBridge.supportsAsync>[0];
  if (bridge.isWebView() && (await supports(openUrlMethod))) {
    try {
      await (bridge.send as (method: string, props: { url: string }) => Promise<unknown>)(
        "VKWebAppOpenUrl",
        { url },
      );
      return;
    } catch {
      // Continue to the browser fallback.
    }
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}
