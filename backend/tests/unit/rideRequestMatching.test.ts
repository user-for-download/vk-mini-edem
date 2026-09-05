import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();
const createNotification = vi.fn();

vi.mock("../../src/db.js", () => ({
  db: { rideRequest: { findMany }, notification: { findFirst } },
}));
vi.mock("../../src/services/notification.service.js", () => ({ createNotification }));

const { notifyMatchingRideRequests } = await import("../../src/rideRequests/matching.js");

describe("RideRequest matching notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([{ id: "request-1", userId: "passenger-1" }]);
    findFirst.mockResolvedValue(null);
  });

  const trip = {
    id: "trip-1",
    driverId: "driver-1",
    fromCityId: "from-city",
    toCityId: "to-city",
    departureAt: new Date("2030-01-01T10:00:00.000Z"),
    durationMinutes: 120,
  };

  it("notifies matching requester with a trip deep link", async () => {
    await notifyMatchingRideRequests(trip);
    expect(createNotification).toHaveBeenCalledWith(
      "passenger-1",
      "ride_request_match",
      "Подходящая поездка",
      expect.stringContaining("trip-1"),
      "/trips/trip-1",
    );
  });

  it("does not duplicate a notification for the same trip", async () => {
    findFirst.mockResolvedValue({ id: "notification-1" });
    await notifyMatchingRideRequests(trip);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
