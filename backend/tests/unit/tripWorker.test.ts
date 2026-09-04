import { afterEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const bookingFindMany = vi.fn().mockResolvedValue([]);
const transaction = vi.fn();

vi.mock("../../src/db.js", () => ({
  db: {
    trip: { findMany },
    booking: { findMany: bookingFindMany },
    $transaction: transaction,
  },
}));

vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../src/logger/business.js", () => ({ logBusinessEvent: vi.fn() }));
vi.mock("../../src/services/notification.service.js", () => ({
  createNotification: vi.fn(),
}));
vi.mock("../../src/ws/manager.js", () => ({
  wsManager: { sendToUser: vi.fn() },
}));

const { startTripWorker, stopTripWorker } = await import(
  "../../src/workers/tripWorker.js"
);

describe("trip worker lifecycle", () => {
  afterEach(() => {
    stopTripWorker();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("starts one detached interval and skips overlapping cycles", async () => {
    vi.useFakeTimers();
    let finishCycle: (() => void) | undefined;
    findMany.mockImplementation(
      () => new Promise<void>((resolve) => (finishCycle = resolve))
    );

    startTripWorker();
    startTripWorker();

    expect(vi.getTimerCount()).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(findMany).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(findMany).toHaveBeenCalledTimes(1);

    finishCycle?.();
    await Promise.resolve();
    stopTripWorker();
    expect(vi.getTimerCount()).toBe(0);
  });
});
