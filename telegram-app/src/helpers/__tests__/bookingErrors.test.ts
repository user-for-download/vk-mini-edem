import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { bookingErrorMessage, isAuthorizationError } from "@/helpers/bookingErrors";

describe("bookingErrorMessage", () => {
  it("maps seat-race conflicts to an actionable message", () => {
    expect(bookingErrorMessage(new ApiError("taken", "SEAT_TAKEN", 409))).toContain(
      "только что заняли",
    );
  });

  it("maps booking overlap to the bookings screen hint", () => {
    expect(
      bookingErrorMessage(new ApiError("overlap", "PASSENGER_BOOKING_OVERLAP", 409)),
    ).toContain("Мои брони");
  });

  it("maps a departed trip to the expired-trip message", () => {
    expect(bookingErrorMessage(new ApiError("past", "TRIP_IN_PAST", 400))).toContain(
      "уже отправилась",
    );
  });

  it("maps 403 without a code to the authorization message", () => {
    expect(bookingErrorMessage(new ApiError("Forbidden", undefined, 403))).toContain(
      "Нет доступа",
    );
  });

  it("maps 401 to the session message", () => {
    expect(bookingErrorMessage(new ApiError("Unauthorized", undefined, 401))).toContain(
      "Сессия истекла",
    );
  });

  it("falls back to a retry message for unknown errors", () => {
    expect(bookingErrorMessage(null)).toContain("повторите");
    expect(bookingErrorMessage(new Error("boom"))).toBe("boom");
  });
});

describe("isAuthorizationError", () => {
  it("detects 401/403 and FORBIDDEN codes", () => {
    expect(isAuthorizationError(new ApiError("x", "FORBIDDEN", 403))).toBe(true);
    expect(isAuthorizationError(new ApiError("x", undefined, 401))).toBe(true);
    expect(isAuthorizationError(new ApiError("x", "SEAT_TAKEN", 409))).toBe(false);
    expect(isAuthorizationError(new Error("x"))).toBe(false);
  });
});
