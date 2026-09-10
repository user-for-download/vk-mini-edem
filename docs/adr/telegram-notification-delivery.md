# ADR: Telegram notification delivery

**Status:** Accepted for parity phase; Bot API option blocked
**Date:** 2026-09-09
**Scope:** Telegram Mini App migration from the frozen VK reference

## Decision

Implement notification parity in this order:

1. **In-app notification inbox** backed by the existing notification records and preference semantics.
2. **WebSocket delivery** for foreground updates, query invalidation and unread-count refresh.
3. Validate parity and operational behavior in Telegram.
4. Treat **background messages through Telegram Bot API as a separate product option**. Do not build, enable, or promise them without explicit product approval.

The first two channels are the functional-parity baseline. A closed app must still show persisted critical notifications when the user next opens it; background delivery is not assumed to be required for parity.

## Frozen reference and mapping

The VK reference has:

- persisted notifications with critical status events created even when optional notifications are disabled;
- WebSocket events for booking/trip changes and `notification:new` refreshes;
- VK-only push/message integrations for selected events.

Telegram mapping:

| Reference behavior | Telegram decision |
|---|---|
| Notification inbox | Required: implement the Telegram route, list, unread count, mark-read and mark-all-read. |
| Foreground VK WebSocket behavior | Required: port auth, ping/pong, reconnect, refresh/resync and event handling. |
| `notifications.sendMessage` / `messages.send` | Not a literal port. Bot API delivery is **blocked** pending product approval. |

## Contract rules

- Critical events (`booking_status_changed`, `trip_cancelled`, `trip_status_changed`) are persisted regardless of the shared optional-notification toggle.
- Optional events follow the user preference and must not leak content through an unapproved external channel.
- WebSocket is best effort: reconnect and resync from the inbox; it is never the source of truth.
- Every notification has a stable event type, safe user-scoped payload, and a Telegram deep-link target defined in [`../migration/notification-parity-contract.md`](../migration/notification-parity-contract.md).
- Delivery failure must not roll back booking, trip, review or support operations.

## Bot API option — blocked decision

**Blocked:** whether any event may be delivered as a background Bot API message, and whether that channel is required for product parity.

Before implementation, Product must approve:

- event allowlist and message copy;
- user consent model and revocation UX;
- whether a Telegram bot chat is mandatory and how it is established;
- privacy review for event text and identifiers;
- deep-link/start-parameter contract;
- retry, deduplication, per-user/global rate limits and abuse controls;
- rollout, opt-out and incident-disable rules.

No `TELEGRAM_BOT_TOKEN` production messaging worker, webhook/polling process, or background send is implied by this ADR. The existing token used for init-data validation is not evidence of approval for outbound messages.

## Ownership

| Area | Owner | Gate |
|---|---|---|
| In-app records, preferences, WebSocket and resync | Backend + Telegram client | Engineering; parity acceptance |
| Event copy, critical/optional classification and Bot API approval | Product | **Blocked until approved** |
| Privacy/consent and data minimization | Product + Security/Privacy | Required before external delivery |
| Bot token, webhook or polling runtime, secret rotation and alerting | Platform/Backend on-call | **Blocked until product approval and runbook** |
| Deep-link routes and start-parameter handling | Telegram client + Backend | Required for every delivered event |

## Consequences

Positive: parity is achievable without coupling core transactions to Telegram messaging, and users can recover missed foreground events from the inbox.
Trade-off: users do not receive an external message while the app is closed unless the separate Bot API option is approved and implemented.

## Acceptance checks

- Telegram can open the inbox, show unread count, paginate, mark one read and mark all read.
- Critical notifications exist with the optional toggle off.
- WebSocket reconnect/resync restores missed notification and booking/trip state.
- No Bot API background message is sent in the parity implementation without a later approved decision record.
