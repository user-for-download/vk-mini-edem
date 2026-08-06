import { z } from "zod";

/**
 * События, которые сервер отправляет клиенту через WebSocket.
 */
export const wsServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("booking:new"),
    payload: z.object({ bookingId: z.string(), tripId: z.string() }),
  }),
  z.object({
    type: z.literal("booking:status_changed"),
    payload: z.object({ bookingId: z.string(), tripId: z.string(), status: z.string() }),
  }),
  z.object({
    type: z.literal("trip:status_changed"),
    payload: z.object({ tripId: z.string(), status: z.string() }),
  }),
  z.object({
    type: z.literal("trip:details_changed"),
    payload: z.object({ tripId: z.string() }),
  }),
  z.object({
    type: z.literal("notification:new"),
    payload: z.object({ id: z.string() }),
  }),
  z.object({
    type: z.literal("error"),
    payload: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export type WsServerEvent = z.infer<typeof wsServerEventSchema>;

/**
 * Сообщения от клиента к серверу.
 */
export const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auth"),
    token: z.string().min(1),
  }),
  z.object({
    type: z.literal("pong"),
  }),
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export const wsPingSchema = z.object({
  type: z.literal("ping"),
});
