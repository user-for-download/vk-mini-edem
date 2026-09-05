# E2E Tests

Full-cycle E2E tests for the Edem VK Mini App using Playwright + Chromium.

## Prerequisites

- Frontend running on `E2E_BASE_URL` (default `http://localhost:3010`)
- Backend running on `http://localhost:3011`
- Dev DB running (docker container `E2E_DB_CONTAINER`, default `vk-mini-edem-db-dev`)
- `ALLOW_DEV_AUTH=true` in backend `.env`
- Seeded users `100001` (driver) and `100004` (passenger); reseed with backend seed if missing
- Playwright browsers installed: `npx playwright install chromium`

## Running

```bash
node e2e/full-cycle.mjs

# Liquidity/safety API flow
node e2e/liquidity-safety.mjs
```

## Env overrides

| Var | Default | Purpose |
| --- | --- | --- |
| `E2E_BASE_URL` | `http://localhost:3010` | Frontend base URL |
| `E2E_DB_CONTAINER` | `vk-mini-edem-db-dev` | Docker container for time-travel (`departureAt`) + cleanup |
| `E2E_VERBOSE` | unset (`1` = verbose) | Log screenshot-helper failures instead of failing the step |
| `E2E_API_URL` | `http://localhost:3011/api/v1` | Backend API base for the liquidity/safety flow |
| `E2E_PASSENGER_ID` | `100004` | Seed/dev-auth passenger |
| `E2E_DRIVER_ID` | `100001` | Seed/dev-auth driver |

`vk_ts` auth timestamps are generated fresh on every `authUrl()` call (single
timestamp per run expires after the 5-min server window on long runs).

## Determinism

- Each run uses unique data: `PRICE = 700 + ((Date.now() + pid) % 90)` plus a
  unique review comment, so repeat runs never collide on cards/search.
- Created trip + its reviews are deleted in a `finally` block (pass or fail);
  bookings cascade via FK.
- `pageerror` / unhandled exceptions fail the run (non-zero exit even at 15/15).
- Cold-start warm-up: one non-counted `goto /` + 60s content wait right after
  browser launch absorbs fresh-vite compile latency; the 15 recorded steps keep
  normal timeouts.
- No swallowed waits on key assertions — missing UI state fails the step loudly.
- Step 13 (complete trip) is state-based: asserts `UPDATE 1` rowcount, waits for
  fresh `GET /trips/:id` after reload, then for the enabled «Завершить поездку»
  button (`waitForFunction`) — no fixed sleeps. All navigations use
  `waitUntil: commit` (WS pages sometimes never fire `load`); readiness is
  asserted by strict content waits after each navigation.

## Test Flow

1. Driver auth (dev-sign) + home screen
2. Search accordion collapsed by default
3. Driver creates trip (Вологда→Череповец, завтра, unique price 700–789₽, 3 seats, tag)
4. Trip visible in "My trips"
5. Passenger auth + search screen
6. Passenger finds the trip
7. Trip details: tags without Card frame + no duplicate status
8. Passenger books a seat
9. Passenger sees "Application sent" status
10. Driver confirms booking
11. Passenger sees snackbar "Your application is confirmed!"
12. Passenger sees "Seat booked" status
13. Driver completes trip (departureTime in past)
14. Passenger leaves review (5★ + comment)
15. Mini-app: `/profile/notifications` → VK push notifications block (banner «Включить» or «Включены»)

The separate `liquidity-safety.mjs` flow checks RideRequest creation, driver matching visibility, pause transition and cleanup. It does not create a booking automatically.

## Artifacts

- Screenshots: `e2e/shots/`
- Results: `e2e/results.json`
