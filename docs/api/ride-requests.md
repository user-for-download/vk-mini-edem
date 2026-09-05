# Ride Requests API

All endpoints require a user access token.

## Endpoints

- `POST /api/v1/ride-requests` creates a request with `fromCityId`, `toCityId`, `earliestAt`, `latestAt`, `expiresAt` and optional `seats`.
- `GET /api/v1/ride-requests` returns the authenticated user's requests.
- `GET /api/v1/ride-requests/matching?fromCityId=&toCityId=&earliestAt=&latestAt=` returns compatible active requests owned by other users. It never creates a booking.
- `PATCH /api/v1/ride-requests/:id` updates the time window, seats or expiry.
- `PATCH /api/v1/ride-requests/:id/status` accepts `active`, `paused`, `fulfilled` or `cancelled` according to the state machine.
- `DELETE /api/v1/ride-requests/:id` marks an owned request as `cancelled`.

At most three non-expired `active`/`paused` requests are allowed per user. Cities must be different directory entries. The backend validates ownership, dates, expiry and city existence.

Matching is informational. The passenger must open the trip and submit the normal booking request explicitly.
