# S0 Product Flow Decisions

Status: proposed for implementation approval
Date: 2026-09-04

## Trip Share and Deep Link

Recommended default: share a route-safe URL containing only the trip ID, for example `/trips/{tripId}` in the existing hash-router format. Use VK Bridge share when available and a normal external URL fallback otherwise.

Opening the link as a guest shows a non-sensitive preview and starts the existing auth flow. After authentication, the app requests the trip detail endpoint. The backend remains the privacy boundary: exact meeting addresses are returned only to the driver or a user with an active booking, as in the current trip-detail policy. Cancelled/completed trips render history state rather than an actionable booking form.

## RideRequest MVP

Recommended first release:

- one user-owned request has `fromCityId`, `toCityId`, date/time window, seats and expiry;
- statuses are `active`, `paused`, `fulfilled`, `expired`, `cancelled`;
- only a bounded number of active requests per user is allowed;
- matching is route-compatible and time-window-compatible, with pagination;
- a driver can discover matching requests, or the passenger can receive a deduplicated notification about a matching trip;
- no automatic booking, seat reservation or driver-side acceptance is created by matching;
- the user must explicitly open a trip and submit a normal booking request;
- expiry is enforced in reads and by an idempotent worker cleanup.

The first version should not introduce fuzzy city matching, recurring requests, chat, payments, or ranking algorithms. Those are separate experiments after measuring match-to-booking conversion.

## Reports

Recommended targets: `user`, `trip`, and `booking`. A user may report another user only when there is a relevant interaction: being the driver/passenger on the same trip or sharing a booking relationship. A trip or booking may be reported by its driver or passenger while the record is available to them. Self-reports are rejected.

Recommended categories: `safety`, `fraud`, `harassment`, `spam`, `inaccurate_info`, `other`. Descriptions are trimmed, sanitized and bounded. One open report per reporter/target/category is allowed, with a server-side rate limit.

Recommended state machine: `pending -> in_review -> resolved | rejected`. Only admins change moderation state; transitions are conditional and record admin actor, timestamp and optional resolution note. Report creation must not reveal whether another report already exists.

## Profile Deletion

Recommended default: soft-delete/anonymize, never direct `db.user.delete`.

- Add a deletion marker (`deletedAt` or an equivalent state) and make auth reject deleted accounts before issuing tokens.
- Revoke all refresh tokens in the same transaction and close the user's WebSocket connections after commit.
- Do not silently cancel active trips or confirmed/pending obligations. Initially return a conflict requiring the user to resolve active obligations; the exact list is defined by the lifecycle implementation.
- Preserve trip, booking, review and report rows needed for operational/history integrity, but replace user-facing identity fields with deterministic anonymous values and remove avatar/about/car data according to a retention matrix.
- Remove or anonymize user feedback and notification content when it contains personal data, while retaining only what is needed for audit.
- Do not allow automatic recreation of a new account for the same `vkUserId` without an explicit product decision. Recommended policy is to block re-login with a clear deleted-account response during the retention period; restoration, if later needed, must be an explicit admin flow.

The endpoint must be authenticated, confirmation-protected in the UI, idempotent for an already deleted account, and resistant to concurrent booking/trip mutations through a transaction and deterministic conflict responses.

## Implementation Gate

Before S2, S3 and S4 coding, confirm these defaults or update this ADR. No application code should infer policy from UI-only state or client-supplied actor/permission fields.
