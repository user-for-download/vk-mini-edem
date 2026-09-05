# Profile Deletion Retention Matrix

Status: approved implementation baseline
Date: 2026-09-05

## User Record

Add `deletedAt DateTime?`. The record remains as the stable foreign-key target for historical rows. On deletion, set `deletedAt`, set `vkUserId` to `null`, replace `name` with a deterministic anonymous label, replace `avatar` with the default avatar, clear `about`, reset rating/review/trip aggregates, and remove the car. Never retain the VK identifier in an application-visible profile after deletion.

The existing unique nullable `vkUserId` permits the original VK account to be detached. The same VK account must not silently create a new account during the retention period. `/auth/vk` and `/auth/refresh` must return a dedicated deleted-account conflict before issuing tokens. Restoration is out of scope and requires an explicit future admin flow.

## Related Data

| Relation | Action | Reason |
| --- | --- | --- |
| `RefreshToken` | Delete/revoke all rows in the same transaction | No active sessions after deletion |
| `Car` | Delete | Profile-owned personal data; no historical need |
| `Trip` | Keep; block deletion while active | Preserve transport history and avoid silent passenger impact |
| `Booking` | Keep; block deletion while pending/confirmed | Preserve obligations and history |
| `Review` | Keep rows, anonymize author/target display through deleted user | Preserve moderation/rating audit without deleted identity |
| `Notification` | Delete | User-specific inbox data is not needed after deletion |
| `Feedback` | Delete or anonymize text according to future retention requirement; initial MVP deletes | Contains free-form personal data |
| `RideRequest` | Cancel terminally, then keep minimal history or delete; initial MVP marks `cancelled` | Do not leave actionable request owned by deleted user |
| `Report` | Keep for moderation audit; reporter display resolves to anonymous user | Safety/moderation records must remain operationally traceable |

## Active Obligations

Deletion returns `409 ACCOUNT_HAS_ACTIVE_OBLIGATIONS` when the user is a driver of an active trip or has pending/confirmed booking on an active trip. The user must cancel/complete those obligations first. The service never cascades trip cancellation or passenger cancellation implicitly.

## Session and WebSocket Cleanup

The transaction revokes/deletes refresh tokens. After a successful commit, close all open WebSocket connections for the user with a documented account-deleted close code/reason. Existing access JWTs are rejected by required auth because the user has `deletedAt`; optional auth treats the account as guest.

## Idempotency and Concurrency

An already deleted account returns a stable success response or a documented `410`, but never creates a second account. Deletion uses a serializable transaction and rechecks active obligations inside it. Concurrent booking/trip mutations either commit before deletion and cause `409`, or observe the deleted state and fail authorization.

## Privacy Acceptance

- Public serializers never expose `vkUserId` for deleted users.
- No notification, push or WebSocket side effect is emitted after deletion.
- Admin can see deletion timestamp and anonymous historical rows, but not the detached VK ID.
- Logs contain the internal user UUID only when operationally necessary; never log launch parameters or tokens.
