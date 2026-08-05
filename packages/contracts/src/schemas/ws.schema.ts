import { z } from "zod";
import { bookingStatusSchema } from "./booking.schema.js";
import { tripStatusSchema } from "./trip.schema.js";

/**
 * События, которые сервер отправляет клиенту через WebSocket.
 */
export const wsEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("booking_created"),
    tripId: z.string(),
    bookingId: z.string(),
    passengerId: z.string(),
    seat: z.number().int(),
  }),
  z.object({
    event: z.literal("booking_status_changed"),
    tripId: z.string(),
    bookingId: z.string(),
    status: bookingStatusSchema,
  }),
  z.object({
    event: z.literal("booking_cancelled"),
    tripId: z.string(),
    bookingId: z.string(),
  }),
  z.object({
    event: z.literal("trip_status_changed"),
    tripId: z.string(),
    status: tripStatusSchema,
  }),
]);

export type WsEvent = z.infer<typeof wsEventSchema>;

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
