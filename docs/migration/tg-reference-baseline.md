# Telegram migration: VK reference baseline

**Baseline date:** 2026-09-09
**Scope:** user-facing VK Mini App, Telegram Mini App, shared backend and contracts.

## Freeze policy

- `mini-app/` is the **frozen, read-only reference** for Telegram parity. Do not add product features or migration fixes to it.
- Do not remove VK until every required row in [the parity matrix](./tg-parity-matrix.md) is `implemented` or explicitly resolved.
- The baseline is repository behavior, not an assertion that every VK path is defect-free.
- There are **no production accounts or production data to transfer**. Dev, seed, fixture and test records are disposable non-production data and do not create a migration requirement.

## User surface frozen from VK

### Routes

The VK hash router defines 17 product routes plus a wildcard fallback ([`mini-app/src/router/index.ts:21-116`](../../mini-app/src/router/index.ts#L21-L116)):

| Area | Frozen routes |
|---|---|
| Home | `/`, `/home/trip/:tripId` |
| Trips | `/trips`, `/trips/search`, `/trips/my`, `/trips/my/:tripId/requests`, `/trips/:tripId` |
| Passenger | `/ride-requests`, `/bookings`, `/bookings/history` |
| Profile | `/profile`, `/profile/reviews`, `/profile/notifications`, `/profile/support` |
| Legal | `/profile/about`, `/profile/about/terms`, `/profile/about/privacy` |
| Fallback | `*` → home |

### Core journeys

- **Home and roles:** persisted passenger/driver role, nearby trips, next passenger booking or driver trip, search and create-trip CTAs ([`mini-app/src/App.tsx:42-57`](../../mini-app/src/App.tsx#L42-L57), [`HomePanel.tsx:34-85`](../../mini-app/src/views/HomeView/panels/HomePanel/HomePanel.tsx#L34-L85)).
- **Search and ride requests:** trip search; create, pause/resume, edit and cancel a passenger ride request ([`mini-app/src/api/rideRequests.api.ts:20-28`](../../mini-app/src/api/rideRequests.api.ts#L20-L28)).
- **Booking:** choose an available seat, add a comment, create a booking, inspect status and cancel it ([`TripDetailsPanel.tsx:724-797`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L724-L797), [`TripDetailsPanel.tsx:588-625`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L588-L625)).
- **Driver trip lifecycle:** create and edit trips; view active/archive; inspect passengers; accept/decline requests; cancel or complete a trip ([`TripsManagePanel.tsx:30-77`](../../mini-app/src/views/ActionView/panels/TripsManagePanel/TripsManagePanel.tsx#L30-L77), [`TripDetailsPanel.tsx:629-721`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L629-L721), [`TripDetailsPanel.tsx:801-860`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L801-L860)).
- **Profiles and contact:** view self/other user, ratings, reviews and car; edit own profile/car; contact an active-booking participant in VK ([`ProfilePanel.tsx:131-214`](../../mini-app/src/views/ProfileView/panels/ProfilePanel/ProfilePanel.tsx#L131-L214), [`TripDetailsPanel.tsx:603-625`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L603-L625)).
- **Reviews and reports:** list authored/about-user reviews, select an eligible completed trip, create a review, and report a trip ([`ReviewsPanel.tsx:65-112`](../../mini-app/src/views/ProfileView/panels/ReviewsPanel/ReviewsPanel.tsx#L65-L112), [`TripDetailsPanel.tsx:127-137`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L127-L137)).
- **Support:** FAQ, create/list/open feedback, inspect support reply, optional external support links and banned-user appeal ([`SupportPanel.tsx:68-90`](../../mini-app/src/views/ProfileView/panels/SupportPanel/SupportPanel.tsx#L68-L90), [`mini-app/src/components/AuthGate.tsx:28-37`](../../mini-app/src/components/AuthGate.tsx#L28-L37)).
- **Account lifecycle:** edit profile; two-step deletion; deletion blocked by active obligations; terminal anonymized state ([`ProfilePanel.tsx:98-129`](../../mini-app/src/views/ProfileView/panels/ProfilePanel/ProfilePanel.tsx#L98-L129), [`backend/tests/integration/profile-deletion.test.ts:32-75`](../../backend/tests/integration/profile-deletion.test.ts#L32-L75)).
- **Consent:** navigation, WebSocket and normal app API are blocked until terms/privacy acceptance is persisted; refusal offers data deletion ([`mini-app/src/components/ConsentGate.tsx:3-16`](../../mini-app/src/components/ConsentGate.tsx#L3-L16), [`mini-app/src/components/ConsentGate.tsx:132-163`](../../mini-app/src/components/ConsentGate.tsx#L132-L163)).

### Deep links and sharing

VK accepts `tripId`, `openHistory=true` and `driverId` query entries; `modal` is parsed but not acted on by `App` ([`mini-app/src/helpers/deepLink.ts:30-48`](../../mini-app/src/helpers/deepLink.ts#L30-L48), [`mini-app/src/App.tsx:88-113`](../../mini-app/src/App.tsx#L88-L113)). Trip sharing emits a route link, while backend VK push fragments target app routes ([`mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx:257-265`](../../mini-app/src/panels/TripDetailsPanel/TripDetailsPanel.tsx#L257-L265), [`backend/src/services/notification.service.ts:17-45`](../../backend/src/services/notification.service.ts#L17-L45)).

### Notifications and real time

- Database notifications distinguish critical status events from optional events; only critical VK recipients are passed to VK push ([`backend/src/services/notification.service.ts:5-45`](../../backend/src/services/notification.service.ts#L5-L45)).
- VK settings cover the shared notification preference plus VK message/push permission ([`NotificationsPanel.tsx:27-49`](../../mini-app/src/views/ProfileView/panels/NotificationsPanel/NotificationsPanel.tsx#L27-L49), [`NotificationsPanel.tsx:141-218`](../../mini-app/src/views/ProfileView/panels/NotificationsPanel/NotificationsPanel.tsx#L141-L218)).
- The notification inbox API supports pagination, unread count, mark-one-read and mark-all-read ([`backend/src/notifications/index.ts:19-93`](../../backend/src/notifications/index.ts#L19-L93)); VK has a client module, but its global listener explicitly says no inbox UI consumes it ([`mini-app/src/components/GlobalWsListener.tsx:33-37`](../../mini-app/src/components/GlobalWsListener.tsx#L33-L37)).
- VK authenticates WebSocket after connect, handles ping/pong, refresh/reconnect, a bounded outbox and resync ([`mini-app/src/providers/WsProvider.tsx:88-192`](../../mini-app/src/providers/WsProvider.tsx#L88-L192), [`mini-app/src/providers/WsProvider.tsx:285-308`](../../mini-app/src/providers/WsProvider.tsx#L285-L308)). It reacts to booking/trip events with query invalidation and in-app messages ([`mini-app/src/components/GlobalWsListener.tsx:39-117`](../../mini-app/src/components/GlobalWsListener.tsx#L39-L117)).

## Shared backend baseline

All user domains are already mounted independently of frontend platform: auth, trips, bookings, reviews, feedback, notifications, ride requests, reports, users, cities and WebSocket ([`backend/src/app.ts:211-223`](../../backend/src/app.ts#L211-L223)). Shared schemas/DTOs and WebSocket events are exported by `packages/contracts/` ([`packages/contracts/src/index.ts`](../../packages/contracts/src/index.ts), [`packages/contracts/src/ws.ts:1-6`](../../packages/contracts/src/ws.ts#L1-L6)).

Telegram auth already validates raw `initData`, upserts by `telegramUserId`, rejects banned/deleted accounts before token issue, and uses the shared JWT/refresh session ([`backend/src/auth/index.ts:209-346`](../../backend/src/auth/index.ts#L209-L346)). Route behavior, profile synchronization and tombstones have integration coverage ([`backend/tests/integration/telegram-auth.test.ts:79-155`](../../backend/tests/integration/telegram-auth.test.ts#L79-L155), [`backend/tests/integration/telegram-auth.test.ts:188-249`](../../backend/tests/integration/telegram-auth.test.ts#L188-L249)).

## Baseline interpretation

- A backend endpoint or Telegram API wrapper alone does **not** make a user journey implemented; the Telegram UI must expose and complete it.
- VK-only mechanics (`VKWebApp*`, VK direct messages and `notifications.sendMessage`) require Telegram-native replacement or an explicit `not applicable` decision, not a literal port.
- Admin-only routes are outside the user parity matrix. Shared backend enforcement and tests are evidence for a row only when Telegram can reach the corresponding journey.
