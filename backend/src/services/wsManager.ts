// backend/src/services/wsManager.ts
import type { WSContext } from "hono/ws";
import type { WsServerEvent } from "@edem/contracts";
import { logger } from "../logger.js";
import { wsConnectionLimitHits, wsConnections, wsAuthenticatedUsers } from "../metrics.js";

const AUTH_TIMEOUT_MS = 5_000;
const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 60_000;
const REAPER_INTERVAL_MS = 30_000;
const MAX_CONNECTIONS_PER_USER = 5;
const MAX_TOTAL_CONNECTIONS = 1_000;

interface Connection {
  ws: WSContext<WebSocket>;
  userId: string | null;
  lastPongAt: number;
  authTimer?: ReturnType<typeof setTimeout>;
  accessExpiryTimer?: ReturnType<typeof setTimeout>;
  pingTimer?: ReturnType<typeof setInterval>;
}

class WebSocketManager {
  private connections = new Map<string, Set<string>>();
  private byId = new Map<string, Connection>();
  private nextConnId = 1;

  register(ws: WSContext<WebSocket>): string {
    const connId = `ws-${this.nextConnId++}`;
    if (this.byId.size >= MAX_TOTAL_CONNECTIONS) {
      wsConnectionLimitHits.inc();
      logger.warn({ connId, limit: MAX_TOTAL_CONNECTIONS }, "ws_global_connection_limit_reached");
      try {
        ws.close(1013, "Too many connections");
      } catch {
        // ignore
      }
      return connId;
    }

    const conn: Connection = {
      ws,
      userId: null,
      lastPongAt: Date.now(),
    };
    this.byId.set(connId, conn);
    wsConnections.inc();

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

  authenticate(connId: string, userId: string, expiresAt?: number): boolean {
    const conn = this.byId.get(connId);
    if (!conn) return false;

    // Повторная аутентификация тем же пользователем (например, после
    // refresh токена) — НЕ закрываем соединение: просто обновляем
    // таймер и возвращаем true. Иначе клиент получает 4401, думает,
    // что токен протух, и уходит в бесконечный цикл refresh → reconnect.
    if (conn.userId === userId) {
      if (conn.authTimer) {
        clearTimeout(conn.authTimer);
        conn.authTimer = undefined;
      }
      this.scheduleAccessExpiry(connId, conn, expiresAt);
      logger.debug({ connId, userId }, "ws_reauthenticated_same_user");
      return true;
    }

    if (conn.userId) return false;

    // Лимит соединений на пользователя: 6-я вкладка/клиент отклоняется.
    // Проверяем ДО присвоения userId, чтобы лимит нельзя было обойти
    // переподключениями одного и того же соединения.
    const userConns = this.connections.get(userId);
    if (userConns && userConns.size >= MAX_CONNECTIONS_PER_USER) {
      wsConnectionLimitHits.inc();
      logger.warn({ connId, userId, limit: MAX_CONNECTIONS_PER_USER }, "ws_connection_limit_reached");
      this.close(connId, 1013, "Too many connections for user");
      return false;
    }

    conn.userId = userId;
    if (conn.authTimer) {
      clearTimeout(conn.authTimer);
      conn.authTimer = undefined;
    }
    this.scheduleAccessExpiry(connId, conn, expiresAt);

    let connSet = this.connections.get(userId);
    if (!connSet) {
      connSet = new Set();
      this.connections.set(userId, connSet);
    }
    connSet.add(connId);
    wsAuthenticatedUsers.set(this.connections.size);

    logger.info({ connId, userId }, "ws_authenticated");
    return true;
  }

  private scheduleAccessExpiry(
    connId: string,
    conn: Connection,
    expiresAt: number | undefined
  ): void {
    if (conn.accessExpiryTimer) clearTimeout(conn.accessExpiryTimer);
    if (expiresAt === undefined) return;

    const delayMs = Math.max(0, expiresAt - Date.now());
    conn.accessExpiryTimer = setTimeout(() => {
      logger.info({ connId }, "ws_access_token_expired");
      this.close(connId, 4401, "Access token expired");
    }, delayMs);
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

  sendToUser(userId: string, event: WsServerEvent): number {
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

  sendToUsers(userIds: string[], event: WsServerEvent): number {
    let total = 0;
    for (const userId of userIds) {
      total += this.sendToUser(userId, event);
    }
    return total;
  }

  /**
   * Закрывает ВСЕ соединения пользователя (например, при бане).
   * Возвращает количество закрытых соединений.
   */
  closeUserConnections(userId: string, code = 1000, reason = ""): number {
    const connIds = this.connections.get(userId);
    if (!connIds || connIds.size === 0) return 0;

    // Копия множества: close() мутирует его, удаляя connId.
    let closed = 0;
    for (const connId of [...connIds]) {
      this.close(connId, code, reason);
      closed++;
    }
    return closed;
  }

  close(connId: string, code = 1000, reason = ""): void {
    const conn = this.byId.get(connId);
    if (!conn) return;

    if (conn.authTimer) clearTimeout(conn.authTimer);
    if (conn.accessExpiryTimer) clearTimeout(conn.accessExpiryTimer);
    if (conn.pingTimer) clearInterval(conn.pingTimer);

    if (conn.userId) {
      const userConns = this.connections.get(conn.userId);
      if (userConns) {
        userConns.delete(connId);
        if (userConns.size === 0) {
          this.connections.delete(conn.userId);
        }
      }
      wsAuthenticatedUsers.set(this.connections.size);
    }

    try {
      conn.ws.close(code, reason);
    } catch {
      // ignore
    }

    this.byId.delete(connId);
    wsConnections.dec();
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

let reaperInterval: NodeJS.Timeout | null = null;
// Флаг остановки: защита от «зомби»-тиков interval, уже попавших в очередь
// event loop после stopWsReaper() — они НЕ должны чистить соединения.
let reaperStopped = false;

/** Тело тика reaper: «зомби»-тик после остановки ничего не чистит. */
function reaperTick(): void {
  // «Зомби»-тик после остановки: логируем отдельным событием и выходим,
  // НЕ трогая соединения (reapStale ниже не вызывается).
  if (reaperStopped) {
    logger.debug("ws_reaper_zombie_tick_ignored");
    return;
  }
  const reaped = wsManager.reapStale();
  if (reaped.length > 0) {
    logger.warn({ count: reaped.length }, "ws_reaped_stale");
  }
}

/** Запускает периодическую очистку «мёртвых» соединений (pong timeout). */
export function startWsReaper(): void {
  if (reaperInterval) return;
  // Повторный запуск после stopWsReaper() обязан «перевзвести» флаг,
  // иначе свежесозданный interval будет игнорировать все тики.
  reaperStopped = false;
  reaperInterval = setInterval(reaperTick, REAPER_INTERVAL_MS);
  reaperInterval.unref?.();
  logger.debug({ intervalMs: REAPER_INTERVAL_MS }, "ws_reaper_started");
}

/** Останавливает reaper (вызывается при graceful shutdown). */
export function stopWsReaper(): void {
  // Идемпотентность: повторный stop не меняет состояние, логируем отдельное событие.
  if (reaperStopped) {
    logger.debug("ws_reaper_already_stopped");
    return;
  }
  // Флаг ставим ДО clearInterval: тик, уже находящийся в очереди,
  // увидит reaperStopped = true и не будет чистить соединения.
  reaperStopped = true;
  if (reaperInterval) {
    clearInterval(reaperInterval);
    reaperInterval = null;
    logger.debug("ws_reaper_stopped");
  }
}

/**
 * Сброс состояния reaper в исходное: reaperInterval = null, reaperStopped = false.
 * ТОЛЬКО ДЛЯ ТЕСТОВ — не вызывает clearInterval для активного таймера.
 */
export function __resetWsReaperState(): void {
  reaperInterval = null;
  reaperStopped = false;
}

/** Вызов тела тика reaper напрямую. ТОЛЬКО ДЛЯ ТЕСТОВ (zombie-guard). */
export function __reaperTickForTests(): void {
  reaperTick();
}
