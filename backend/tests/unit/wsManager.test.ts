// backend/tests/unit/wsManager.test.ts
// Юнит-тесты безопасности WS-reaper (Phase 4): zombie-тики после stop,
// идемпотентный stop, повторный запуск (re-arm), интеграция интервала
// через fake timers. logger замокан, metrics.js реальный (in-memory, без сети).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Logger замокан полностью: ни один тест не должен писать в stdout/файлы.
vi.mock("../../src/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from "../../src/logger.js";
import {
  wsManager,
  startWsReaper,
  stopWsReaper,
  __resetWsReaperState,
  __reaperTickForTests,
} from "../../src/services/wsManager.js";

const REAPER_INTERVAL_MS = 30_000;

/**
 * debug-вызовы logger с заданным сообщением. Сообщение может быть как первым
 * аргументом (logger.debug("ws_reaper_stopped")), так и вторым
 * (logger.debug({ intervalMs }, "ws_reaper_started")) — ищем по любому аргументу.
 */
const debugWith = (msg: string) =>
  vi.mocked(logger.debug).mock.calls.filter((call) => call.includes(msg));

/** warn-вызовы logger с заданным сообщением (по любому аргументу вызова). */
const warnWith = (msg: string) =>
  vi.mocked(logger.warn).mock.calls.filter((call) => call.includes(msg));

describe("wsManager reaper safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetWsReaperState();
  });

  afterEach(() => {
    vi.clearAllMocks();
    __resetWsReaperState();
    vi.useRealTimers();
  });

  it("startWsReaper logs ws_reaper_started with intervalMs 30000", () => {
    // Arrange — состояние сброшено в beforeEach

    // Act
    startWsReaper();

    // Assert
    expect(logger.debug).toHaveBeenCalledWith(
      { intervalMs: REAPER_INTERVAL_MS },
      "ws_reaper_started"
    );
    expect(debugWith("ws_reaper_started")).toHaveLength(1);

    stopWsReaper();
  });

  it("double start does not create a second interval", () => {
    // Arrange — состояние сброшено в beforeEach

    // Act — повторный start ранним return'ом не трогает существующий интервал
    startWsReaper();
    startWsReaper();
    stopWsReaper();

    // Assert — ровно одно стартовое и ровно одно stop-событие
    expect(debugWith("ws_reaper_started")).toHaveLength(1);
    expect(debugWith("ws_reaper_stopped")).toHaveLength(1);
  });

  it("stopWsReaper is idempotent: second stop logs ws_reaper_already_stopped", () => {
    // Arrange
    startWsReaper();

    // Act — второй stop не должен менять состояние или бросать
    stopWsReaper();
    stopWsReaper();

    // Assert — активный stop логирует ws_reaper_stopped, повторный — отдельное событие
    expect(debugWith("ws_reaper_stopped")).toHaveLength(1);
    expect(debugWith("ws_reaper_already_stopped")).toHaveLength(1);
  });

  it("stopWsReaper when never started sets the flag without ws_reaper_stopped log", () => {
    // Arrange — reaper никогда не запускался (beforeEach сбросил состояние)

    // Act — первый stop без запуска: только ставит флаг, интервала нет
    stopWsReaper();

    // Assert — stop-события нет: лог «остановлен» пишется только при живом интервале
    expect(debugWith("ws_reaper_stopped")).toHaveLength(0);
    expect(debugWith("ws_reaper_already_stopped")).toHaveLength(0);

    // Act — второй stop: флаг уже стоит → отдельное событие
    stopWsReaper();

    // Assert
    expect(debugWith("ws_reaper_already_stopped")).toHaveLength(1);
  });

  it("zombie tick after stop is ignored (reapStale NOT called, no ws_closed)", () => {
    // Arrange
    startWsReaper();
    stopWsReaper();
    const reapSpy = vi.spyOn(wsManager, "reapStale").mockReturnValue([]);

    // Act — «зомби»-тик, уже стоявший в очереди event loop после stop
    __reaperTickForTests();

    // Assert — тик отклонён: соединения не чистятся, ничего не закрывается
    expect(debugWith("ws_reaper_zombie_tick_ignored")).toHaveLength(1);
    expect(reapSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalledWith(expect.anything(), "ws_closed");
  });

  it("normal tick before stop calls reapStale", () => {
    // Arrange
    startWsReaper();
    const reapSpy = vi.spyOn(wsManager, "reapStale").mockReturnValue([]);

    // Act — живой тик: reaper работает
    __reaperTickForTests();

    // Assert — reapStale вызван, «зомби»-лога нет, warn нет (пустой результат)
    expect(reapSpy).toHaveBeenCalledTimes(1);
    expect(debugWith("ws_reaper_zombie_tick_ignored")).toHaveLength(0);
    expect(warnWith("ws_reaped_stale")).toHaveLength(0);

    stopWsReaper();
  });

  it("re-arm after stop: __resetWsReaperState allows a fresh start", () => {
    // Arrange — полный цикл stop → reset
    startWsReaper();
    stopWsReaper();
    __resetWsReaperState();

    // Act — повторный запуск: флаг обязан быть перевзведён
    startWsReaper();
    const reapSpy = vi.spyOn(wsManager, "reapStale").mockReturnValue([]);
    __reaperTickForTests();

    // Assert — тик снова работает, «зомби»-лога нет
    expect(reapSpy).toHaveBeenCalledTimes(1);
    expect(debugWith("ws_reaper_zombie_tick_ignored")).toHaveLength(0);

    stopWsReaper();
  });

  it("interval integration: tick fires every 30s and stops reaping after stop", () => {
    // Arrange — fake timers ТОЛЬКО в этом тесте
    vi.useFakeTimers();
    const reapSpy = vi.spyOn(wsManager, "reapStale").mockReturnValue([]);
    startWsReaper();

    // Act — 30s прошло: интервал сработал ровно один раз
    vi.advanceTimersByTime(REAPER_INTERVAL_MS);

    // Assert
    expect(reapSpy).toHaveBeenCalledTimes(1);

    // Act — stop + ещё 60s: никаких «зомби»-тиков
    stopWsReaper();
    vi.advanceTimersByTime(2 * REAPER_INTERVAL_MS);

    // Assert — счётчик не изменился, «зомби»-событий нет
    expect(reapSpy).toHaveBeenCalledTimes(1);
    expect(debugWith("ws_reaper_zombie_tick_ignored")).toHaveLength(0);
  });
});
