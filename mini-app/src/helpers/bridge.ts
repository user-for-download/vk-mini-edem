import vkBridge from "@vkontakte/vk-bridge";
import vkBridgeMock from "@vkontakte/vk-bridge-mock";

const customBridgeMock = new Proxy(vkBridgeMock, {
  get(target, prop, receiver) {
    if (prop === "send") {
      return async (method: string, props?: any) => {
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
        return vkBridgeMock.send(method as any, props);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const bridge = import.meta.env.DEV
  ? (customBridgeMock as unknown as typeof vkBridge)
  : vkBridge;


