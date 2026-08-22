# Edem Current Memory

Updated: 2026-08-21

## Project

Edem is a VK Mini App for shared rides. It is an npm-workspaces TypeScript monorepo:

- `mini-app/`: React 19, VKUI v8, Vite, TanStack Query, Zustand, VK Bridge.
- `backend/`: Hono, Prisma, PostgreSQL, JWT/refresh auth, WebSocket notifications.
- `packages/contracts/`: shared Zod schemas and DTOs.

## Runtime

- Local root `npm run dev` builds `packages/contracts` first, then starts frontend on `3010` and backend on `3011`.
- `VITE_API_TARGET` controls the Vite API/WebSocket proxy target.
- Production Docker backend listens on `3000` and serves `mini-app/dist`; Compose publishes it only on `127.0.0.1:3000`, while PostgreSQL is available only inside the Docker network.
- Production requires `DATABASE_URL`, `JWT_SECRET`, `VK_APP_SECRET`, and `CORS_ORIGINS`.
- `ALLOW_DEV_AUTH` is disabled in production and only supports local/test mock auth.

## Authentication

- VK launch params are sent as the complete `searchParams` string.
- Backend verifies the `sign` HMAC and rejects stale `vk_ts` values older than five minutes.
- Client-provided `firstName`, `lastName`, and `photo` are not trusted identity data.
- JWT access tokens are kept in the in-memory frontend API client.
- Refresh tokens are rotated and stored hashed in PostgreSQL. Rotation revokes the old token with a single atomic UPDATE (`revokedAt IS NULL` predicate), so exactly one concurrent rotation succeeds.
- Refresh token reuse detection: presenting an already-rotated token to `/auth/refresh` revokes ALL active tokens of that user (token family revocation). A repeated `/logout` with an old token does not revoke the family.
- Auth rate limits are configurable: `VK_AUTH_RATE_WINDOW_MS`/`VK_AUTH_RATE_MAX` (default 5/5min) and `REFRESH_RATE_WINDOW_MS`/`REFRESH_RATE_MAX` (default 10/10min). The old `AUTH_RATE_*` variables were removed.

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
- WebSocket auth sends `{ type: "auth", token }` after connecting to `/api/v1/ws`; the token is not placed in the URL. The server closes authenticated connections when their access JWT expires.
- WebSocket contract (`packages/contracts`) matches the implementation: server sends `auth:ok`, `ping` (keep-alive), and business events; client sends only `auth` and `pong`. Dead `pong`/`error` server events, `wsPingSchema`, and a client `ping` variant were removed.
- WebSocket cleanup guards against stale sockets and reconnects after provider unmount.
- Swipe settings use `VKWebAppSetSwipeSettings`; raw swipe messages require a parent window and allowed VK origins.
- VK community messaging is optional. `VK_GROUP_TOKEN` is submitted to VK API in a POST body.

## Verification

Verified on 2026-08-21 after the refresh-token rotation hardening and the low-severity audit remediation:

- `npm run typecheck` passed for all workspaces.
- Frontend tests: 34 passed.
- Contracts tests: 28 passed.
- Backend tests: 102 passed (incl. new `refresh-rotation` integration suite: concurrent rotation race, reuse family revocation, double-logout safety).
- `npm run format:check`, `npm run lint`, `npm run bundle:check` passed.
- Production `npm run build` passed; Docker image builds on `node:22-alpine` (matches CI Node 22 and `engines: >=22`).

Booking and review pagination responses are validated against shared contracts and fail closed with HTTP 500 on contract drift; current fixtures use valid shared-schema seat limits.

Remaining production limitation: rate limiting and WebSocket fan-out are process-local and require Redis/pub-sub for horizontally scaled backend instances. See the production limitations section in `README.md`.

The production frontend passes the enforced initial and per-chunk gzip budgets; route and vendor splitting remain in place.

## Documentation Rules

When behavior changes, update this file and the relevant README/API document in the same change. Keep commands and ports synchronized with the root `package.json`, and document security-sensitive behavior from the implementation rather than old plans.
