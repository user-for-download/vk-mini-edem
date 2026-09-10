# Final parity sign-off (reassessment)

**Task:** tg-migration-24.
**Baseline matrix:** [`tg-parity-matrix.md`](./tg-parity-matrix.md) (written 2026-09-09,
*before* tasks 06–17). This document reassesses every matrix row against the
current code and test evidence. The baseline file is left frozen as history.
**Status legend:** `resolved` · `accepted` (Telegram-specific alternative) ·
`remaining` (gap, non-blocking per gate doc) · `blocked` (needs product decision).

## Reassessment

### Routes and navigation

| VK reference | Verdict | Evidence |
|---|---|---|
| `/` home dashboard | `accepted` | Search is the deliberate landing (`AppRouter` wildcard → `/trips`); no HomePage route by design. E2E asserts search-first flow |
| `/trips`, `/trips/my`, `/trips/my/:tripId/requests`, `/trips/my/new`, `/trips/:tripId`, `/bookings`, `/bookings/history`, `/ride-requests` | `resolved` | Routes + journeys covered by backend parity suite (16) and E2E (17) 16/16 |
| `/profile`, `/reviews`, `/settings`, `/notifications`, `/profile/support`, `/profile/reports` | `resolved` | All routed (`AppRouter.tsx:136-141`); implemented in tasks 06–10 |
| Unknown route fallback | `resolved` | → `/trips`; E2E deeplink leg |
| Native back/tab navigation | `resolved` | SDK Back Button + 4 root tabs |

### User actions

| Capability | Verdict | Evidence |
|---|---|---|
| Role switch and persistence | `accepted` | Fixed role-context tabs instead of a switch; journeys complete without it (E2E) |
| Search/paginate, create/cancel/complete trip, ride-request lifecycle, booking create/status/cancel, requests accept/decline | `resolved` | Tasks 06–07, 12; e2e + integration suites |
| Active/archive driver tabs + request counts | `resolved` | `MyTripsPage` tabs; E2E complete leg asserts archive |
| Confirm destructive actions | `resolved` | `ConfirmAction` (arm + description); E2E exercises it |
| Seat selector + booking comment | `resolved` | `TripDetailsPage` aria-labelled seats; E2E books seat 1 |
| Trip detail (addresses/tags/duration/distance/price) | `resolved` | Detail page + `TripCard`; masked for strangers (parity suite) |
| Profile view/edit, car upsert, account deletion + obligations | `resolved` | Tasks 06–07; profile-deletion + parity lifecycle legs |
| Reviews list/create/moderation visibility | `resolved` | `ReviewsPage` tabs (mine/about); approve → published asserted API + UI |
| Reports create/conflicts | `resolved` | Task 09; parity + `reports.test.ts` matrices |
| Support FAQ/feedback/reply | `resolved` | Task 09; E2E reply-visible leg |
| Notification inbox/preferences | `resolved` | Tasks 09–10; inbox 500-bug fixed + covered |
| Offline indicator + recovery | `resolved` | `OfflineBanner` (stale warning + restored confirmation); E2E reconnect leg |
| Share trip | `resolved` | ` TripDetailsPage` share (`trip_<uuid>` format per contract) |
| Logout | `resolved` | `ProfilePage` logout (`POST /auth/logout` + local clear) |
| Banned-user appeal | `resolved` | `AppealForm` in gate + support; backend appeal tested |
| Onboarding/consent gate + legal docs | `resolved` | Task 10 `Onboarding` (accept/decline/delete); E2E accepts it |
| Open another user's profile | `remaining` | Public reviews endpoint exists; dedicated stranger-profile UI absent |
| History filters | `remaining` | List works; all/completed/cancelled filter UI absent |
| Edit trip / edit ride request | `remaining` | API supports PATCH; UI exposes create/status only |
| External support links | `blocked` | Needs Product destination decision (matrix decision 4) |
| Participant contact | `blocked` | Needs privacy-safe mechanism decision (matrix decision 3) |

### API, notifications, realtime, deep links, auth

| Area | Verdict | Evidence |
|---|---|---|
| All client wrappers + backend routes (auth, trips, bookings, cities, ride-requests, users, reviews, feedback, reports, notifications) | `resolved` | Tasks 06–15; 241 contract + 232 TG-app tests |
| In-app delivery (critical override, dedupe, deep-link allowlist) | `resolved` | Task 15 + suites |
| WS auth/ping-pong/backoff/4403/resync + listener | `resolved` | Task 14 + suites + smoke 4401 |
| startapp/deep-link parsing + fallbacks | `resolved` | `deepLinks.ts` + tests + E2E fallback leg |
| Auth lifecycle (initData/TTL/refresh/ban/tombstone) | `resolved` | Tasks 10, 13; auth + appeal + security suites |
| Bot API background delivery | `blocked` | ADR: needs Product approval (matrix decision 1) |
| Bot deep-link/button mapping | `blocked` | Follows Bot API decision (matrix decision 2) |
| Migration/linking | `not applicable` | No production data (policy; tasks 19, 23) |

## Critical-gap assessment

No `remaining` item breaks a core journey (search → trip → booking → status →
review → support → settings → lifecycle all pass E2E 16/16). `remaining` items
are UX conveniences, tracked for post-cutover iteration — none blocks the
deletion gate by itself. `blocked` items block only their own external
channels, not parity of the shipped surface.

The gate verdict (including owner signature) lives in
[`vk-deletion-gate.md`](./vk-deletion-gate.md).
