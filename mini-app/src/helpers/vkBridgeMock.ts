// mini-app/src/helpers/vkBridgeMock.ts
/**
 * Мок VK Bridge для локальной разработки вне ВКонтакте.
 *
 * В production используется настоящий @vkontakte/vk-bridge.
 */
export const vkBridgeMock = {
  send: async (method: string, params?: Record<string, unknown>) => {
    console.log("[VKBridge Mock]", method, params);

    switch (method) {
      case "VKWebAppInit":
        return { result: true };

      case "VKWebAppGetUserInfo":
        return {
          id: 100001,
          first_name: "Илья",
          last_name: "Северов",
          photo_200: "https://i.pravatar.cc/200?img=12",
        };

      case "VKWebAppGetLaunchParams":
        return {
          vk_user_id: 100001,
          vk_app_id: 0,
          vk_platform: "desktop_web",
          vk_is_app_user: true,
          vk_are_notifications_enabled: true,
          vk_language: "ru",
          vk_ref: "other",
          vk_access_token_settings: "",
          vk_sign: "dev-sign",
          ts: Date.now(),
        };

      case "VKWebAppSetViewSettings":
        return { result: true };

      case "VKWebAppOpenUrl":
        window.open((params as { url?: string })?.url, "_blank");
        return { result: true };

      default:
        return { result: true };
    }
  },
  isWebView: () => false,
  subscribe: () => () => {},
  supports: () => false,
};
