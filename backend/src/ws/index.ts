import { verifyAccessToken } from "../auth/tokens.js";
import { wsManager } from "../services/wsManager.js";
import { logger } from "../logger.js";
import { wsClientMessageSchema } from "@edem/contracts";

export function createWsHandler(upgradeWebSocket: any) {
  return upgradeWebSocket(() => ({
    onOpen(_evt: any, ws: any) {
      const connId = wsManager.register(ws);
      (ws as any).__connId = connId;
    },

    async onMessage(evt: MessageEvent, ws: any) {
      const connId = (ws as any).__connId as string;

      let parsed: unknown;
      try {
        parsed = JSON.parse(String(evt.data));
      } catch {
        logger.warn({ connId }, "ws_invalid_json");
        wsManager.close(connId, 1003, "Invalid JSON");
        return;
      }

      const result = wsClientMessageSchema.safeParse(parsed);
      if (!result.success) {
        logger.warn({ connId }, "ws_unknown_message_type");
        return;
      }

      const msg = result.data;

      if (msg.type === "pong") {
        wsManager.handlePong(connId);
        return;
      }

      if (msg.type === "auth") {
        try {
          const userId = await verifyAccessToken(msg.token);
          const ok = wsManager.authenticate(connId, userId);
          if (!ok) {
            wsManager.close(connId, 4401, "Already authenticated");
          }
        } catch {
          logger.warn({ connId }, "ws_auth_failed");
          wsManager.close(connId, 4401, "Invalid token");
        }
      }
    },

    onClose(_evt: any, ws: any) {
      const connId = (ws as any).__connId as string;
      if (connId) wsManager.close(connId);
    },

    onError(err: Error, ws: any) {
      const connId = (ws as any).__connId as string;
      logger.error({ connId, err }, "ws_error");
      if (connId) wsManager.close(connId, 1011, "Error");
    },
  }));
}
