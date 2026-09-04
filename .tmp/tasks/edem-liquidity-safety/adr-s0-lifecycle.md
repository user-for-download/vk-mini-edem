# S0 Lifecycle Decisions

Status: proposed for implementation approval
Date: 2026-09-04

## Pending Booking Expiry

Recommended default: do not add a new persisted `expired` booking status in the first implementation. Add `expiresAt` to pending bookings and treat `pending && expiresAt <= now` as inactive in all queries and mutation guards. A worker may materialize the existing terminal status `declined` after the expiry window, with an idempotent conditional update and the same seat/index semantics.

Reason: the current active partial indexes are defined for `pending` and `confirmed`; avoiding a new status limits schema and history churn while preserving a clear timestamp for audit. If product analytics requires a distinct expired status, it must be approved as a follow-up because it affects every status schema and admin/history filter.

Initial TTL recommendation: 24 hours after a booking request is created, capped so that a request cannot remain actionable after trip departure. The exact value is an S0 approval decision, not a hidden implementation constant.

## Trip Completion

Keep the existing hourly worker and its `Serializable` conditional claim. A trip is auto-completed when it is still `active` and `departureAt < now - 24 hours`. Manual completion remains available to the driver under its existing guards. Both paths must converge on the same terminal booking transitions and notifications, and all side effects remain outside the transaction.

No automatic completion should be introduced for trips before departure or merely because all seats are filled. Completion is a point of no return; retries must be no-ops.

## Cancellation Audit

Recommended default: add nullable audit fields to the entities whose status can be cancelled/declined, rather than overloading free-form comments:

- `cancelledAt` timestamp;
- `cancelledByType`: `user | admin | system`;
- `cancelledByUserId` nullable for system actions;
- `cancellationReason` nullable, trimmed and bounded.

For driver rejection, use the same audit shape only if the product exposes a reason; otherwise preserve `declined` semantics and do not pretend it is cancellation. Every automatic transition uses `system` and is idempotent.

The actor must be derived from the authenticated session or server worker, never accepted as a trusted client field. Admin actions must preserve the existing admin guard.

## Implementation Gate

Before S1 coding, confirm the TTL value, whether declined is sufficient for expiry, and whether booking and trip cancellation audit need one shared relation or nullable fields. Any decision that changes these recommendations must update this ADR and the dependent task contracts first.
