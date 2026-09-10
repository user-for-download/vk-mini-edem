# Contract Gap Audit

Date: 2026-09-09
Scope: `packages/contracts`, `backend/src`, `mini-app/src/api`,
`telegram-app/src/api`, and the current WebSocket producer/consumer code.

## Result

The existing trip, booking, review, ride-request, city, user, auth,
feedback, and report contracts cover the JSON request/response shapes used by
the current backend routes. Telegram data clients already use those shared
schemas for their implemented endpoints. No VK product behavior was changed.

One contract gap was confirmed and addressed: notifications had a schema only
inside `mini-app/src/api/notifications.api.ts`; the backend and future Telegram
client therefore had no shared notification DTO. Added exports:

- `notificationSchema` / `Notification`
- `notificationsPageSchema` / `NotificationsPage`

The new schema and its boundary cases are covered by
`packages/contracts/tests/notification.schema.test.ts`. Consumers should be
migrated to these exports as part of the Telegram notifications task; this
audit intentionally does not add a Telegram product module or alter the VK
client.

## HTTP Parity Matrix

Legend: **shared** means the request type and/or response parser is imported
from `@edem/contracts`; **gap** means migration work remains; **exception**
means the endpoint is intentionally platform-specific or admin-only.

| API surface | Request contract | Response contract | VK/TG parity finding |
| --- | --- | --- | --- |
| `POST /auth/vk` | `AuthRequest` | `authResponseSchema` | VK-only exception |
| `POST /auth/telegram` | `TelegramAuthRequest` | `authResponseSchema` | Shared response; Telegram implemented |
| `POST /auth/refresh` | `RefreshRequest` | `authResponseSchema` | Shared |
| `GET/PATCH /users/*` | `CompleteOnboardingBody`; profile/car bodies are local inferred types | `userSchema` | Body schemas for profile/car are not shared; migrate before final contract freeze |
| `DELETE /users/me` | none | local `{ success: boolean }` | Generic success response is duplicated in clients |
| `GET /cities/suggest` | `citySuggestQuerySchema` (backend) | `citySuggestResponseSchema` | Shared response; client transforms `items` to its view type |
| `GET/POST/PATCH /trips*` | `TripFiltersDto`, `CreateTripDto`, `UpdateTripDto` | `tripSchema`, `paginatedTripsResponseSchema` | Shared |
| `GET/POST/PATCH /bookings*` | booking DTOs | booking and pagination schemas | Shared; `/my` and `/history` use enriched fields accepted by `passengerBookingSchema` |
| `GET/POST /reviews*` | `CreateReviewDto` | review and pagination schemas | Shared; `/my` adds optional `tripId` locally |
| `GET/PATCH/DELETE /ride-requests*` | ride-request DTOs | list shape is re-declared locally; item is `rideRequestSchema` | **Gap:** export a paginated ride-request response schema and consume it in Telegram |
| `POST/GET /feedback` | `CreateFeedbackDto` | feedback DTO schemas | VK client only; Telegram API module absent |
| `POST /feedback/appeal` | `FeedbackAppealDto` | `createFeedbackResponseSchema` | VK-signature/VK launch-data exception; not Telegram-compatible |
| `GET/PATCH /notifications*` | none | **new** `notificationSchema`, `notificationsPageSchema` | **Gap:** Telegram module absent; VK client has duplicate local schemas |
| `POST/GET /reports` | `CreateReportDto` | `reportSchema` | VK client only; Telegram API module absent |
| `/admin/*` | admin DTO/query schemas | admin schemas | Admin-only exception, not Mini App parity |

### Request-body notes

- `updateProfile` currently accepts `Partial<Pick<User, "name" | "about">>`
  in both the backend validation path and Telegram client, but there is no
  shared update-profile schema.
- `CarFormDto` is declared locally in the Telegram client and is validated by
  an inline/backend-local shape. It should become a shared write DTO before
  the VK implementation is removed.
- `{ success: boolean }` is repeated for account deletion, mark-all-read,
  and cancellation. This is low risk but should be consolidated if a common
  response contract is introduced.

These are migration backlog gaps, not additions in this subtask, because
changing the write schemas requires checking exact backend validation and
would widen the deliverable beyond a read-only audit.

## WebSocket Matrix

### Client to server

| Payload | Producer | Shared schema | Finding |
| --- | --- | --- | --- |
| `{ type: "auth", token }` | VK `WsProvider` | `wsClientMessageSchema` / `WsClientEvent` | Shared; Telegram producer absent |
| `{ type: "pong" }` | VK `WsProvider` | `wsClientMessageSchema` | Shared; Telegram producer absent |

The server rejects all other client messages. `ping` is server-originated and
must not be sent by clients.

### Server to client

| Payload | Backend producer | Shared schema | Finding |
| --- | --- | --- | --- |
| `{ type: "auth:ok" }` | `backend/src/ws/index.ts` | `wsServerEventSchema` | Shared |
| `{ type: "ping" }` | `wsManager.register` interval | `wsServerEventSchema` | Shared |
| `booking:new` | booking route | `wsServerEventSchema` | Shared |
| `booking:status_changed` | booking route | `wsServerEventSchema` | Shared shape, status is only `string` |
| `trip:status_changed` | trips route/worker/admin | `wsServerEventSchema` | Shared shape, status is only `string` |
| `trip:details_changed` | trips route | `wsServerEventSchema` | Shared |
| `notification:new` | booking/trip worker/admin flows | `wsServerEventSchema` | Shared ID-only invalidation event |

The current VK consumer validates every incoming frame with
`wsServerEventSchema`, handles `auth:ok`/`ping`, and exposes business events to
listeners. There is no Telegram WebSocket consumer or reconnect/resync
implementation, so real-time parity is an explicit migration gap.

The two status payloads intentionally remain permissive in this audit:
backend status values are domain-dependent and the current shared schema uses
`string`. Tightening them to `tripStatusSchema`/`bookingStatusSchema` needs a
producer inventory and compatibility test first; it is not required to add a
Telegram contract today.

## Required Follow-up

- Add Telegram notifications, feedback, and reports API modules using the
  shared contracts; add their route/query tests.
- Replace the VK notification-local schemas with the new shared exports when
  the Telegram notifications work is implemented. This is a contract-only
  substitution and should not change UI behavior.
- Add a shared paginated ride-request response schema and shared profile/car
  write schemas after backend validation shapes are confirmed.
- Implement Telegram WebSocket auth, ping/pong, reconnection, event parsing,
  and resync before declaring API parity.
- Add backend integration assertions that serialized notification and WS
  payload examples parse successfully through the shared schemas.

## Verification

The contract package checks for this deliverable are:

- `npm run typecheck --workspace @edem/contracts`
- `npm run test --workspace @edem/contracts`

The notification schema is exported through the existing package root; no
existing exports were removed or renamed.
