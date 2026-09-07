import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// api-client — граница доверия к backend-ответам: схема обязана отсеивать
// неконформные тела, а ошибки — маппиться в типизированный ApiError
// (audit: webapp не имел ни одного теста; schema validation failures and
// non-2xx responses produce typed, user-visible error states).
import { apiGet, apiPost, ApiError } from "./api-client";

const userSchema = z.object({ id: z.string().uuid(), name: z.string() });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

describe("api-client — schema validation", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "window",
      { location: { pathname: "/users", assign: vi.fn() } },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns parsed data for a conforming response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Анна",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiGet("/users/me", userSchema);
    expect(data).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Анна",
    });
  });

  it("throws typed ApiError (INVALID_RESPONSE) on a schema mismatch", async () => {
    // id не uuid — тело не проходит контракт.
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { id: "not-a-uuid", name: "Анна" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/users/me", userSchema).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("INVALID_RESPONSE");
    expect((error as ApiError).status).toBe(502);
  });

  it("throws typed ApiError (INVALID_RESPONSE) on invalid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(textResponse(200, "не json вообще"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/users/me", userSchema).catch((e) => e);
    expect((error as ApiError).code).toBe("INVALID_RESPONSE");
  });

  it("throws typed ApiError (INVALID_RESPONSE) when a schema is required but the body is empty", async () => {
    // 204 No Content: тело обязательно null (fetch-спека запрещает тело у 204).
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/users/me", userSchema).catch((e) => e);
    expect((error as ApiError).code).toBe("INVALID_RESPONSE");
    expect((error as ApiError).status).toBe(204);
  });
});

describe("api-client — error mapping", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "window",
      { location: { pathname: "/users", assign: vi.fn() } },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps a backend error body { code, message } to ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, { code: "SEAT_TAKEN", message: "Место занято" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/bookings/123", userSchema).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).code).toBe("SEAT_TAKEN");
    expect((error as ApiError).message).toBe("Место занято");
  });

  it("falls back to INTERNAL_ERROR when the error body is not JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(textResponse(500, "Internal Server Error"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/users", userSchema).catch((e) => e);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).code).toBe("INTERNAL_ERROR");
  });

  it("redirects to /login on 401 outside /auth/* paths", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/users", assign } });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { code: "UNAUTHORIZED", message: "Session expired" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await apiGet("/users", userSchema).catch((e) => e);
    expect((error as ApiError).status).toBe(401);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does NOT redirect on 401 from /auth/login (form shows the error)", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname: "/login", assign } });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { code: "UNAUTHORIZED", message: "Invalid token" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/auth/login", { token: "x" }, userSchema).catch(() => {});
    expect(assign).not.toHaveBeenCalled();
  });
});
