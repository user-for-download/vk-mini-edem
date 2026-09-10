# Telegram parity test matrix

**Scope:** tg-migration-16. Backend integration suite for Telegram user journeys.
**Suite:** `backend/tests/integration/telegram-parity.test.ts`
**Fixtures:** `backend/tests/fixtures/telegram.ts`
**Run:** `npx vitest run tests/integration/telegram-parity.test.ts` (from `backend/`)

Conventions: real `app.request()` HTTP, isolated data (telegramUserId
BigInt 9_940_000+, unique X-Real-IP per request under TRUST_PROXY),
dev-initData login through the real `/auth/telegram`, mock tokens elsewhere,
cleanup in the lifecycle leg.

## Journey legs

| Leg | Endpoints | Semantics asserted (beyond HTTP 200) |
|---|---|---|
| auth | POST /api/v1/auth/telegram | User upserted by telegramUserId, access+refresh tokens issued, repeat login returns same user |
| trip | POST /api/v1/trips, GET /api/v1/trips/:id | 201 + id; same-city pair rejected 400; NO_CAR without a car; public deep-link masks addresses from strangers, driver sees full |
| booking | POST /api/v1/bookings, PATCH /api/v1/bookings/:id/status, GET /api/v1/bookings/my | 201 + id; seat race → 409 SEAT_TAKEN; stranger confirm → 403; driver confirm → status confirmed; booking visible in passenger list |
| notifications | GET /api/v1/notifications/my, PATCH /api/v1/notifications/:id/read | booking_status_changed present; unreadCount ≥ 1; cursor pagination (limit=1 → nextCursor → page 2); read flips isRead and decrements unreadCount by exactly 1 |
| review | POST /api/v1/reviews, GET /api/v1/reviews/user/:id, PATCH /api/v1/admin/reviews/:id/approve, GET /api/v1/reviews/my | 201; duplicate → 409; pending invisible in public list; approved → visible; author sees it in /my |
| support | POST /api/v1/feedback, POST /api/v1/admin/feedback/:id/reply | 201 + persisted; empty text → 400; admin reply 200 + reply persisted |
| report | POST /api/v1/reports | 201; duplicate open → 409; self-report → 403 |
| trip cancel | PATCH /api/v1/trips/:id/cancel | 200; passenger inbox gains trip_cancelled |
| lifecycle | GET/DELETE /api/v1/users/me, POST /api/v1/auth/telegram | /me returns own id; DELETE anonymizes (deletedAt); repeat login → 403 tombstone |

## Related suites (not duplicated here)

| Area | Existing suite |
|---|---|
| TG auth edge cases, ban/tombstone, races | telegram-auth.test.ts |
| Trips/bookings races, ownership, deep-link masking | telegram-trips-bookings.test.ts |
| TG appeal without token | telegram-appeal.test.ts |
| TG delivery policy (opt-out, critical, dedupe) | telegram-notifications.test.ts |
| Reviews pagination/moderation matrix | reviews-pagination, review-moderation, review-unique-null-trip |
| Feedback validation/appeal, admin reply cycle | feedback, feedback-appeal, feedback-list, admin-feedback-reply |
| Reports conflict matrix | reports.test.ts |
| Account deletion obligations | profile-deletion.test.ts |
| Realtime contract | ws-manager, ws-limits + telegram-app ws tests, e2e/telegram-realtime.mjs |

## Product bugs found by this suite

1. `GET /api/v1/notifications/my` (and `PATCH /:id/read`) always returned
   500: Prisma `Date` passed into `notificationSchema.parse`, contract expects
   ISO string. Fixed by `toISOString()` serialization in
   `backend/src/notifications/index.ts` (shared VK/TG route).
