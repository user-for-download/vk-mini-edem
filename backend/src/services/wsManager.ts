import type { WSContext } from "hono/ws";
import type { WsEvent } from "@edem/contracts";
import { logger } from "../logger.js";

const AUTH_TIMEOUT_MS = 5_000;
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 60_000;

interface Connection {
  ws: WSContext<WebSocket>;
  userId: string | null;
  lastPongAt: number;
  authTimer?: ReturnType<typeof setTimeout>;
  pingTimer?: ReturnType<typeof setInterval>;
}

class WebSocketManager {
  private connections = new Map<string, Set<string>>();
  private byId = new Map<string, Connection>();
  private nextConnId = 1;

  register(ws: WSContext<WebSocket>): string {
    const connId = `ws-${this.nextConnId++}`;
    const conn: Connection = {
      ws,
      userId: null,
      lastPongAt: Date.now(),
    };
    this.byId.set(connId, conn);

    conn.authTimer = setTimeout(() => {
      if (!conn.userId) {
        logger.warn({ connId }, "ws_auth_timeout");
        this.close(connId, 4401, "Authentication timeout");
      }
    }, AUTH_TIMEOUT_MS);

    conn.pingTimer = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        this.close(connId, 1011, "Ping failed");
      }
    }, PING_INTERVAL_MS);

    return connId;
  }

  authenticate(connId: string, userId: string): boolean {
    const conn = this.byId.get(connId);
    if (!conn) return false;
    if (conn.userId) return false;

    conn.userId = userId;
    if (conn.authTimer) {
      clearTimeout(conn.authTimer);
      conn.authTimer = undefined;
    }

    let userConns = this.connections.get(userId);
    if (!userConns) {
      userConns = new Set();
      this.connections.set(userId, userConns);
    }
    userConns.add(connId);

    logger.info({ connId, userId }, "ws_authenticated");
    return true;
  }

  handlePong(connId: string): void {
    const conn = this.byId.get(connId);
    if (conn) {
      conn.lastPongAt = Date.now();
    }
  }

  reapStale(): string[] {
    const now = Date.now();
    const stale: string[] = [];
    for (const [connId, conn] of this.byId) {
      if (now - conn.lastPongAt > PONG_TIMEOUT_MS) {
        stale.push(connId);
      }
    }
    for (const connId of stale) {
      this.close(connId, 1001, "Pong timeout");
    }
    return stale;
  }

  sendToUser(userId: string, event: WsEvent | any): number {
    const connIds = this.connections.get(userId);
    if (!connIds || connIds.size === 0) return 0;

    const payload = JSON.stringify(event);
    let sent = 0;
    for (const connId of connIds) {
      const conn = this.byId.get(connId);
      if (!conn) continue;
      try {
        conn.ws.send(payload);
        sent++;
      } catch {
        this.close(connId, 1011, "Send failed");
      }
    }
    return sent;
  }

  sendToUsers(userIds: string[], event: WsEvent | any): number {
    let total = 0;
    for (const userId of userIds) {
      total += this.sendToUser(userId, event);
    }
    return total;
  }

  close(connId: string, code = 1000, reason = ""): void {
    const conn = this.byId.get(connId);
    if (!conn) return;

    if (conn.authTimer) clearTimeout(conn.authTimer);
    if (conn.pingTimer) clearInterval(conn.pingTimer);

    if (conn.userId) {
      const userConns = this.connections.get(conn.userId);
      if (userConns) {
        userConns.delete(connId);
        if (userConns.size === 0) {
          this.connections.delete(conn.userId);
        }
      }
    }

    try {
      conn.ws.close(code, reason);
    } catch {
      // ignore
    }

    this.byId.delete(connId);
    logger.info({ connId, code, reason }, "ws_closed");
  }

  closeAll(code = 1001, reason = "Server shutting down"): void {
    for (const connId of this.byId.keys()) {
      this.close(connId, code, reason);
    }
  }

  getStats() {
    return {
      totalConnections: this.byId.size,
      authenticatedUsers: this.connections.size,
    };
  }
}

export const wsManager = new WebSocketManager();

setInterval(() => {
  const reaped = wsManager.reapStale();
  if (reaped.length > 0) {
    logger.warn({ count: reaped.length }, "ws_reaped_stale");
  }
}, 30_000).unref?.();
