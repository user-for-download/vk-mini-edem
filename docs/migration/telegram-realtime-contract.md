# Telegram WebSocket and realtime contract

**Status:** migration baseline, version `ws.v1`
**Source:** frozen VK `WsProvider`/`GlobalWsListener`, `backend/src/ws`, and `@edem/contracts`
**Scope:** Telegram Mini App foreground realtime transport. This document defines the existing wire contract; it does not implement a Telegram WebSocket client.

## Compatibility decision

The current shared contract is canonical in `packages/contracts/src/schemas/ws.schema.ts` and is exported from `packages/contracts/src/index.ts` (and `packages/contracts/src/ws.ts`). No `packages/contracts/src/schemas/ws.ts` file is added: it would duplicate the existing schema module and create two competing exports. The Telegram client must consume the existing `wsServerEventSchema`, `wsClientMessageSchema`, `WsServerEvent`, and `WsClientEvent` exports.

Adding Telegram support does not change the event names or payloads. Any future wire change must be made in the existing schema module, reviewed as a protocol version change, and update this document and its tests together.

## Transport

- Endpoint: `GET /api/v1/ws`, using `wss://` when the Telegram app is served over HTTPS. Derive the WebSocket origin from the configured API origin; do not put an access token or init data in the URL.
- The browser WebSocket API cannot set an `Authorization` header. Authentication is therefore the first application message after `open`, not a query parameter or cookie.
- The Telegram app is served from the configured Telegram host (`TELEGRAM_HOSTS`) with ordinary SPA deep-link fallback. WebSocket URL derivation must continue to target the API host, not a `t.me` URL or a Telegram bot URL.
- `Origin` is browser-controlled and must be checked/allowed at the deployment edge or WebSocket upgrade boundary against the exact configured Telegram web origins. Do not allow arbitrary origins or treat `Origin` as identity. CORS does not authenticate a WebSocket upgrade.
- Telegram WebView lifecycle can suspend networking when backgrounded. A client may pause reconnect attempts while hidden/offline and resume on visibility/online events; it must not assume that a suspended socket retained delivery guarantees.

## Client-to-server messages

The client sends JSON messages only:

```json
{"type":"auth","token":"<short-lived JWT access token>"}
{"type":"pong"}
```

`auth` must be sent once immediately after `open`. The JWT is the same access token issued by `POST /api/v1/auth/telegram`; raw Telegram `initData` is **not** a WebSocket credential and must never be sent over this channel. `pong` is sent in response to every server `ping`. There is no client-initiated `ping`, subscription message, or business mutation message in `ws.v1`.

The server validates the JWT signature/expiry, looks up the user, rejects deleted or banned accounts, and binds the connection to that user. The access token expiry is scheduled server-side; refreshing an HTTP token does not mutate an existing socket. The client reconnects with the new access token after refresh.

## Server-to-client messages

All business messages are delivered to the authenticated user as JSON. `auth:ok` and `ping` have no payload.

| Type | Payload | Meaning |
|---|---|---|
| `auth:ok` | none | JWT accepted; the socket is ready for business events. |
| `ping` | none | Server keep-alive; reply with `pong`. |
| `booking:new` | `{ bookingId: string, tripId: string }` | A new booking/request relevant to the user was created. |
| `booking:status_changed` | `{ bookingId: string, tripId: string, status: string }` | A booking status changed. Current domain values are `pending`, `confirmed`, `declined`, and `cancelled`; clients must tolerate a newly added value. |
| `trip:status_changed` | `{ tripId: string, status: string }` | A relevant trip changed status. Current values are `active`, `cancelled`, and `completed`; clients must tolerate a newly added value. |
| `trip:details_changed` | `{ tripId: string }` | Refresh the authoritative trip details. No private route/address data is sent in the event. |
| `notification:new` | `{ id: string }` | A persisted in-app notification changed; fetch the notification/inbox resource when that API is available. The event is a hint, not durable delivery. |

Unknown or malformed messages are ignored by the shared parser/client. The current server does not send a structured `error` or `pong` event.

## Close codes and client action

| Code | Current server meaning | Telegram client action |
|---|---|---|
| `1000` | Normal/provider shutdown | Stop this socket; reconnect only when the authenticated app lifecycle starts again. |
| `1001` | Pong timeout or server shutdown | Reconnect with backoff after network/lifecycle permits. Resync after `auth:ok`. |
| `1003` | Invalid JSON/data | Treat as a client/protocol bug; do not tight-loop. Reconnect with bounded backoff only after logging a redacted diagnostic. |
| `1011` | Server/send/internal error | Reconnect with bounded backoff. |
| `1013` | Capacity, message-rate, or auth-attempt throttle | Reconnect with bounded backoff and jitter; do not retry aggressively. |
| `1008` or `4401` | Invalid/expired JWT, auth timeout, missing/deleted user, or auth conflict | Run the existing single-flight HTTP refresh. On success reconnect with the new access token; on permanent failure clear the session and return to Telegram auth. |
| `4403` | Account banned or deleted during auth, or an already authenticated user was banned/deleted | Stop automatic reconnect, clear/disable the session according to HTTP auth policy, show the account-state screen. A ban close is terminal until a new authenticated session is explicitly established; never refresh-loop it. |

Close reasons are diagnostics only and must not be displayed as trusted authorization data. Codes not listed above follow the transient reconnect policy unless the server explicitly documents them as terminal.

## Reconnect, refresh, and resync

- Use bounded exponential backoff with jitter: baseline `1s`, doubling per attempt, maximum `30s`, with approximately `0.75..1.25` jitter. Reset the attempt counter only after a successful `auth:ok`.
- Do not open parallel sockets. Do not reconnect while an HTTP token refresh is in flight; refresh completion wakes the connection attempt.
- On `1008`/`4401`, use the existing HTTP refresh single-flight. Never place a refreshed token in the URL. If refresh is rejected permanently, stop and let the Telegram auth gate handle the session.
- On every reconnect after a previously successful `auth:ok`, perform a foreground resync after the new `auth:ok`. The resync is HTTP/query invalidation, not a WebSocket replay request.
- The server does not provide event IDs, cursors, acknowledgements, replay, or exactly-once delivery. WebSocket delivery is best effort. HTTP resources and persisted notifications are authoritative.
- Deduplicate repeated event effects by event type plus stable payload identifiers/state, as the frozen listener does. Resync must happen before treating subsequent socket events as current where the query library permits it.

## Query invalidation parity

The Telegram listener must preserve the frozen VK behavior:

| Event | Required invalidation/effect |
|---|---|
| Any reconnect resync | Invalidate all trip queries and all booking queries; refetch authoritative state. |
| `booking:new` | `trips/my`, booking-by-trip, trip lists, and trip detail for `tripId`; show a deduplicated informational notice. |
| `booking:status_changed` | `bookings/my`, `bookings/history`, booking-by-trip, `trips/my`, trip detail, and trip lists; notify on `confirmed`/`declined`. |
| `trip:status_changed` | `trips/my`, booking lists/history, trip detail, and trip lists; notify on `cancelled`/`completed`. |
| `trip:details_changed` | Trip detail, `trips/my`, and trip lists; notify that details changed. |
| `notification:new` | Invalidate the notifications/inbox query once the Telegram notifications API/query exists. Never treat the event alone as the notification record. |

The exact query-key constants may differ in `telegram-app`, but their semantic coverage must not be reduced. Effects must be idempotent and independent from mutation success.

## Telegram deep links and security constraints

- WebSocket transport stays on the HTTPS API/app origin. `t.me` links and `startapp` parameters are navigation inputs, not transport or authentication inputs.
- Preserve the existing raw `retrieveRawInitData()` -> `/auth/telegram` flow. Never reserialize, sort, log, or append raw init data to WebSocket URLs.
- Deep links may select an initial route (for example `trip_<uuid>`), but must be validated as untrusted input and resolved through authenticated HTTP queries. Never put JWTs, init data, private addresses, or contact data in `startapp` parameters.
- A Telegram username, WebView origin, host header, or deep-link parameter is not a user identity. Identity comes from the validated Telegram init data during HTTP login and the subsequent JWT claims/database checks.
- Use `wss` in production, secure cookies/headers for HTTP as currently configured, redacted logs, and the existing per-IP/per-user/message/auth-attempt limits. Telegram transport differences must not weaken those limits.

## Required verification before Telegram client implementation

- Contract tests continue to accept every listed v1 message and reject malformed payloads.
- Integration coverage proves auth timeout, expired-token refresh, `4403` terminal handling, ping/pong timeout, reconnect backoff, and query resync.
- A Telegram WebView test verifies HTTPS/WSS, background/foreground recovery, exact allowed origin, and deep-link route selection without credentials in the URL.
- Any new event, payload field, close code, replay/cursor mechanism, or query invalidation rule requires a versioned update to this document and the canonical `ws.schema.ts`; do not add a second schema file.
