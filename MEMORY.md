# Edem Current Memory

Updated: 2026-08-18

## Project

Edem is a VK Mini App for shared rides. It is an npm-workspaces TypeScript monorepo:

- `mini-app/`: React 19, VKUI v8, Vite, TanStack Query, Zustand, VK Bridge.
- `backend/`: Hono, Prisma, PostgreSQL, JWT/refresh auth, WebSocket notifications.
- `packages/contracts/`: shared Zod schemas and DTOs.

## Runtime

- Local root `npm run dev` starts frontend on `3010` and backend on `3011`.
- `VITE_API_TARGET` controls the Vite API/WebSocket proxy target.
- Production Docker backend listens on `3000` and serves `mini-app/dist`; current compose also publishes backend `3000` and PostgreSQL `5432` on all host interfaces, which requires production firewall/proxy hardening.
- Production requires `DATABASE_URL`, `JWT_SECRET`, `VK_APP_SECRET`, and `CORS_ORIGINS`.
- `ALLOW_DEV_AUTH` is disabled in production and only supports local/test mock auth.

## Authentication

- VK launch params are sent as the complete `searchParams` string.
- Backend verifies the `sign` HMAC and rejects stale `vk_ts` values older than five minutes.
- Client-provided `firstName`, `lastName`, and `photo` are not trusted identity data.
- JWT access tokens are kept in the in-memory frontend API client.
- Refresh tokens are rotated and stored hashed in PostgreSQL.

## Business Invariants

- Active booking statuses are `pending` and `confirmed`.
- Partial unique indexes prevent duplicate active seat and passenger bookings.
- Driver booking decisions allow only `pending -> confirmed|declined` before trip departure.
- Cancelled, declined, and confirmed bookings cannot be resurrected by the driver endpoint.
- Trip seat resizing validates occupied seat numbers inside a serializable transaction.
- Expired trip completion atomically claims an active trip before changing counters or sending side effects.
- Reviews are directional: passenger to driver or driver to confirmed passenger.
- Public profiles omit license plates; public trip responses mask exact meeting addresses.

## VK Integration

- `VKWebAppInit` is fire-and-forget in `mini-app/src/main.tsx`.
- VKUI receives appearance, insets, adaptivity, platform, and WebView state through `AppConfig`.
- Session state reacts to browser visibility and VK view hide/restore events.
- WebSocket auth sends `{ type: "auth", token }` after connecting to `/api/v1/ws`; the token is not placed in the URL. Existing connections are not explicitly closed when the access JWT expires.
- WebSocket cleanup guards against stale sockets and reconnects after provider unmount.
- Swipe settings use `VKWebAppSetSwipeSettings`; raw swipe messages require a parent window and allowed VK origins.
- VK community messaging is optional. `VK_GROUP_TOKEN` is submitted to VK API in a POST body.

## Verification

Verified on 2026-08-18 after the current source audit:

- `npm run typecheck` passed for all workspaces.
- Frontend tests: 8 passed.
- Contracts tests: 25 passed.
- Backend tests: 82 passed.
- Production `npm run build` passed.
- `git diff --check` passed.

The backend test run logs a known contract-validation warning for booking pagination: test fixtures use seat values above the shared schema maximum, while the endpoint still returns HTTP 200. This is documented as an open defect, not treated as a clean contract result.

The audit also identified unresolved issues around trip-detail stale data/error states, driver booking pagination, WebSocket/Vite proxy path consistency, date/timezone boundaries, multi-instance WebSocket/rate-limit state, review availability per target, and production Docker exposure/runtime hardening. See the production limitations and audit section in `README.md`.

The build still reports a non-blocking large main JavaScript chunk warning. Further vendor/route splitting is a performance follow-up, not a correctness blocker.

## Documentation Rules

When behavior changes, update this file and the relevant README/API document in the same change. Keep commands and ports synchronized with the root `package.json`, and document security-sensitive behavior from the implementation rather than old plans.
