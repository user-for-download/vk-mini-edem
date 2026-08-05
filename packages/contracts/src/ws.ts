import type { WsServerEvent, WsClientMessage } from "./schemas/ws.schema.js";

export type { WsServerEvent };
export type WsClientEvent = WsClientMessage | { type: "ping" };

