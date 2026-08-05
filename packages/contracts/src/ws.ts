import { z } from "zod";

export type WsClientEvent = 
  | { type: "ping" }
  | { type: "chat:send"; payload: { tripId: string; text: string } };

export type WsServerEvent = 
  | { type: "pong" }
  | { type: "error"; payload: { code: string; message: string } }
  | { type: "booking:status_changed"; payload: { bookingId: string; tripId: string; status: string } }
  | { type: "booking:new"; payload: { bookingId: string; tripId: string } }
  | { type: "trip:status_changed"; payload: { tripId: string; status: string } }
  | { type: "notification:new"; payload: { id: string } };

