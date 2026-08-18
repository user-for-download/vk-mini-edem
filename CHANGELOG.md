# Changelog

Все заметные изменения проекта документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Security And Integrity Hardening

- VK authentication verifies the complete signed launch parameter string and does not trust unsigned profile fields or derive `isVerified` from browser input.
- Public profiles omit license plates; public trip responses mask exact pickup and destination addresses.
- VK community messages use `POST /messages.send`; the community token is not placed in the request URL.
- Driver booking decisions are rate-limited and restricted to `pending -> confirmed|declined` before departure. No-op decisions do not create duplicate notifications.
- Review authorization is directional: passenger -> driver or driver -> confirmed passenger.
- Trip auto-completion atomically claims active trips, and seat resizing revalidates occupied seat numbers inside the serializable transaction.
- Notification cursors validate UUID/date payloads and reject invalid fractional limits.
- Frontend API response validation fails closed on schema drift; login and refresh responses use `authResponseSchema`.
- WebSocket cleanup prevents reconnects after unmount and ignores stale socket callbacks. VK visibility and swipe-back lifecycle handling is synchronized and cleaned up.

### API And Database

- `POST /bookings` returns `200` for an idempotent retry by the same passenger and seat, `409 SEAT_TAKEN` for another passenger, and `409 ALREADY_BOOKED` for another seat held by the same passenger.
- Partial unique indexes `active_seat_booking` and `active_passenger_booking` protect active bookings from races.
- `GET /reviews/user/:userId` and `GET /bookings/trip/:tripId` use cursor pagination with `limit` and `cursor` validation.
- Legacy trips are normalized to the four-seat maximum; active out-of-range bookings are declined during migration.
- Trip worker processing is batched with keyset pagination and atomic active-trip claiming.

### Historical Notes

- API robustness includes idempotent booking retries, partial unique booking indexes, and Serializable conflict handling.
- Cursor-based pagination is used for public user reviews and driver booking requests.
- Trip worker processing uses bounded batches, keyset pagination, selective reads, and `Promise.allSettled` for side effects.
- Sentry helpers strip PII, VK launch timestamp drift is observable, and the WebSocket reaper has idempotent shutdown and zombie-tick protection.
- CI checks contracts, Prisma validation, typechecking, build, tests, and untracked build artifacts.

### Observability And Tooling

- Sentry initialization is centralized with PII stripping for users, request data, and sensitive extra fields.
- VK launch timestamp drift over one minute is logged and reported for diagnostics; timestamps older than five minutes are rejected.
- WebSocket reaper shutdown is idempotent and ignores queued zombie ticks.
- CI verifies contracts, Prisma, typechecking, build, tests, and that build artifacts are not tracked.

### Verification

- `npm run typecheck` passed for all workspaces.
- 113 tests passed: 8 frontend, 24 contracts, 81 backend.
- `npm run build` passed.

### Breaking Changes

- `POST /bookings` idempotent retries now return `200` with the existing booking instead of `409`.
- `GET /reviews/user/:userId` and `GET /bookings/trip/:tripId` return `{ items, pagination }` instead of a bare array.
