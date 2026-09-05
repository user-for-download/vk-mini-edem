// Deterministic API-level Playwright checks for the liquidity/safety release.
import { request } from "playwright";

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const API = process.env.E2E_API_URL || "http://localhost:3011/api/v1";
const PASSENGER_ID = process.env.E2E_PASSENGER_ID || "100004";
const DRIVER_ID = process.env.E2E_DRIVER_ID || "100001";

async function login(context, vkUserId) {
  const response = await context.post("auth/vk", {
    headers: { "Content-Type": "application/json" },
    data: { searchParams: `vk_user_id=${vkUserId}&vk_app_id=0&vk_platform=desktop_web&vk_ts=${Math.floor(Date.now() / 1000)}&sign=dev-sign` },
  });
  expect(response.status() === 200, `auth failed for VK user ${vkUserId}: ${response.status()}`);
  return (await response.json()).accessToken;
}

async function main() {
  const context = await request.newContext({ baseURL: `${API.replace(/\/$/, "")}/` });
  const tokens = { passenger: await login(context, PASSENGER_ID), driver: await login(context, DRIVER_ID) };
  const auth = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
  let createdRequestId = null;

  try {
    const citiesResponse = await context.get("cities/suggest?limit=100");
    expect(citiesResponse.ok(), "cities request failed");
    const cities = (await citiesResponse.json()).items;
    expect(cities.length >= 2, "city directory has fewer than two cities");
    const [from, to] = cities;
    const create = await context.post("ride-requests", {
      headers: { ...auth("passenger"), "Content-Type": "application/json" },
      data: { fromCityId: from.id, toCityId: to.id, earliestAt: "2030-01-01T09:00:00.000Z", latestAt: "2030-01-01T12:00:00.000Z", expiresAt: "2030-01-02T00:00:00.000Z" },
    });
    expect(create.status() === 201, `ride request create failed: ${create.status()}`);
    const rideRequest = await create.json();
    createdRequestId = rideRequest.id;
    expect(rideRequest.status === "active", "ride request is not active");
    const matching = await context.get(`ride-requests/matching?fromCityId=${from.id}&toCityId=${to.id}&earliestAt=2030-01-01T10:00:00.000Z&latestAt=2030-01-01T11:00:00.000Z`, { headers: auth("driver") });
    expect(matching.ok(), "matching request failed");
    const pause = await context.patch(`ride-requests/${createdRequestId}/status`, { headers: { ...auth("passenger"), "Content-Type": "application/json" }, data: { status: "paused" } });
    expect(pause.status() === 200, `pause request failed: ${pause.status()}`);
    expect((await pause.json()).status === "paused", "ride request was not paused");
    console.log("PASS | RideRequest create, matching and pause flow");
  } finally {
    if (createdRequestId) {
      const cleanup = await context.delete(`ride-requests/${createdRequestId}`, { headers: auth("passenger") });
      expect([200, 404].includes(cleanup.status()), `cleanup failed: ${cleanup.status()}`);
    }
    await context.dispose();
  }
}

main().catch((error) => {
  console.error(`FAIL | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
