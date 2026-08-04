import vkBridge from "@vkontakte/vk-bridge";
import { vkBridgeMock } from "./vkBridgeMock";

export const bridge = import.meta.env.DEV
  ? (vkBridgeMock as unknown as typeof vkBridge)
  : vkBridge;
