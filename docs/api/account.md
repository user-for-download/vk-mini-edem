# Account Deletion API

`DELETE /api/v1/users/me` requires the current user's access token and performs transactional soft deletion/anonymization.

The operation returns `409 ACCOUNT_HAS_ACTIVE_OBLIGATIONS` when the user owns an active trip or has a pending/confirmed booking on a future active trip. The server never silently cancels those obligations.

On success, the server marks `deletedAt`, anonymizes user-facing profile data, removes the car, notifications, feedback and refresh-token rows, cancels owned RideRequests, and closes the user's WebSocket connections. Historical trips, bookings, reviews and reports remain linked to the anonymous tombstone for integrity.

The signed `vkUserId` is retained as a tombstone so the same VK identity cannot silently create a second account. `/auth/vk` and `/auth/refresh` reject deleted accounts with `403` and no tokens.
