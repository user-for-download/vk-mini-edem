# S0 Baseline Audit

Дата аудита: 2026-09-04

## Existing Domain State

| Aggregate | Persisted statuses | Current active semantics | Main transition owners |
| --- | --- | --- | --- |
| `Trip` | `active`, `cancelled`, `completed` | Only `active` trips are searchable; `completed` is reached manually or by the worker; cancelled rows remain for history | `backend/src/trips/index.ts`, `backend/src/admin/index.ts`, `backend/src/workers/tripWorker.ts` |
| `Booking` | `pending`, `confirmed`, `declined`, `cancelled` | `pending` and `confirmed` occupy the active passenger/seat uniqueness slots | `backend/src/bookings/index.ts`, `backend/src/trips/index.ts`, admin booking override |
| `Review` | `pending`, `published`, `rejected` | Only published reviews affect public lists and ratings | `backend/src/reviews/index.ts`, `backend/src/reviews/rating.ts`, admin moderation |
| `User` | no deletion state; `bannedAt` is present | Banned users are rejected on auth, refresh, HTTP and WS paths | `backend/src/auth`, `backend/src/users`, `backend/src/ws`, admin users |

## Lifecycle Findings

1. `processExpiredTrips()` runs hourly and claims only `active` trips with `departureAt < now - 24h`.
2. The claim is an atomic `updateMany` inside a `Serializable` transaction, guarded by `status` and cutoff. This is the existing idempotency/race boundary.
3. After claiming a trip, pending bookings become `declined`, confirmed and driver counters are incremented, and notifications/WS/push side effects execute outside the transaction using `Promise.allSettled`.
4. The worker currently does not expire pending bookings independently before trip completion. Any new pending TTL must preserve the partial unique indexes and seat accounting.
5. Manual completion and worker completion have overlapping behavior and need regression comparison before changes. Do not replace the worker as part of S0.
6. Admin cancellation rejects already completed/cancelled trips and changes only trip status. Existing cancellation side effects and counter behavior must be preserved unless S0.02 approves audit fields.
7. Booking decisions are guarded by trip departure/status and booking status. A driver cannot resurrect cancelled, declined or confirmed bookings through the normal decision endpoint.

## Existing Product Capabilities Not To Reimplement

- VK launch-param authentication, JWT access tokens and rotated hashed refresh tokens.
- Ban enforcement on VK auth, refresh, HTTP optional/required auth and WebSocket.
- Trip search/create/edit/cancel/complete and booking request/decision/cancel flows.
- Notification persistence, WebSocket events and critical VK push notifications.
- City directory with `fromCityId`/`toCityId` validation and locked route editing.
- Review moderation, feedback, admin auth and existing admin pagination patterns.

## Planned Change Boundaries

| Planned area | Existing files likely to conflict | Required contract decision before coding |
| --- | --- | --- |
| Pending expiry and cancellation audit | `backend/prisma/schema.prisma`, trip/booking routes, worker, status contracts, partial indexes | TTL, status vs `expiresAt`, actor/reason model, notification semantics |
| Share/deep link | mini-app router/deep-link helpers, trip detail endpoint, serializers | URL format, auth fallback and private-address disclosure |
| RideRequest | Prisma schema, contracts index, `backend/src/app.ts`, notifications, mini-app navigation | MVP fields, matching boundaries, limits, expiry and notification deduplication |
| Reports | Prisma schema, contracts, app/admin routing, serializers, admin webapp | target permissions, categories, state machine, audit and retention |
| Profile deletion | User relations, auth/refresh, serializers, WS manager, admin views | active obligations, anonymization mapping, token cleanup and same-VK re-login |

## Recommended Dependency Order

1. Complete S0.02 and S0.03 decisions without changing production schema.
2. Implement and test only approved lifecycle changes in S1.
3. Add RideRequest model/contracts before its backend and UI work.
4. Add Reports after lifecycle semantics are stable; do not share schema edits concurrently with RideRequest.
5. Implement deletion after Reports and retention relationships are known.
6. Run migrations, complete documentation, security review and release checks in S5.

## Acceptance Notes

- S0 is an audit deliverable only; no application behavior changes are implied.
- Any new status must be added consistently to Prisma comments, contracts, serializers, filters, admin UI and tests.
- Every mutation touching active seats or obligations must retain a transaction/race test.
- Public serializers must continue to omit exact meeting addresses and undisclosed VK identifiers.
