import type { WsServerEvent, WsClientMessage } from "./schemas/ws.schema.js";

export type { WsServerEvent };
// Клиент отправляет только auth и pong (ответ на серверный keep-alive ping).
export type WsClientEvent = WsClientMessage;

