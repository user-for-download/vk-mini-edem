# Backend environment variables

## Numeric values

Explicit numeric settings must be positive safe integers. Zero, negative,
fractional, partially numeric, and out-of-range values stop startup with the
variable name instead of silently changing runtime behavior. Unset variables use
the defaults from `src/env.ts`.

This applies to `PORT`/`BACKEND_PORT`, `JWT_ACCESS_TTL_SECONDS`,
`JWT_REFRESH_TTL_SECONDS`, `ADMIN_JWT_TTL_SECONDS`, all `*_RATE_WINDOW_MS` and
`*_RATE_MAX` settings, and the optional `VK_GROUP_ID`. An unset `VK_GROUP_ID`
disables community messaging; an explicitly configured value must be positive.

## Auth rate limits

Auth endpoints use independent IP-based limiters:

| Variable pair | Endpoint | Default |
|---|---|---|
| `VK_AUTH_RATE_WINDOW_MS` / `VK_AUTH_RATE_MAX` | `POST /api/v1/auth/vk` | 5 minutes / 5 requests |
| `REFRESH_RATE_WINDOW_MS` / `REFRESH_RATE_MAX` | `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` | 10 minutes / 10 requests |
| `ADMIN_LOGIN_RATE_WINDOW_MS` / `ADMIN_LOGIN_RATE_MAX` | `POST /api/v1/admin/auth/login` | 5 minutes / 5 requests |

The former single `AUTH_RATE_WINDOW_MS`/`AUTH_RATE_MAX` pair was never wired to
the limiters and has been removed. CI sets both `*_MAX` values high so
integration tests are never throttled.

## Admin panel

`ADMIN_TOKEN` is the static secret protecting the admin panel. It is compared
timing-safe against the body of `POST /api/v1/admin/auth/login`; a successful
login sets the httpOnly cookie `edem_admin_jwt` containing a JWT
(`type=admin-access`, `sub=admin`) signed with `JWT_SECRET`.

- Unset/empty `ADMIN_TOKEN` disables the whole admin API in every environment:
  every request under `/api/v1/admin` (including login) returns `403`. There is
  deliberately no ephemeral development fallback for this variable.
- Wrong token on login returns `401`; missing/invalid/expired session cookie on
  guarded endpoints returns `401`.
- `ADMIN_JWT_TTL_SECONDS` controls the session TTL (cookie `Max-Age` and JWT
  `exp`). Default `43200` (12 hours). There are no refresh tokens: after
  expiry the admin logs in again.
- The admin login limiter is IP-based (anti-bruteforce); in-memory buckets are
  cleared by a backend restart.
- The cookie `Secure` flag follows the request `X-Forwarded-Proto` header
  (`https` → `Secure`, `http` → no `Secure`) so login also works on HTTP-only
  admin domains behind a reverse proxy; the proxy must set/forward the header
  (`webapp/nginx.conf` does). Without the header the flag falls back to
  `isProduction`.

Example environment entries:

```dotenv
ADMIN_TOKEN=replace-with-a-long-random-secret
ADMIN_JWT_TTL_SECONDS=43200
ADMIN_LOGIN_RATE_WINDOW_MS=300000
ADMIN_LOGIN_RATE_MAX=5
```

## VK push notifications

`VK_SERVICE_KEY` is the **service access key** of the mini-app (not the
community token). It is used by `notifications.sendMessage` to deliver real
push notifications to users on key events (booking confirmed/rejected, trip
cancelled, trip completed). The service key is obtained in the VK console
(dev.vk.com → Mini-app settings → Service access key) and is a secret —
treat it like `JWT_SECRET`: do not log, do not commit, rotate on leak.

- Unset/empty `VK_SERVICE_KEY` disables VK push: critical notifications are
  still persisted to the DB and delivered over WebSocket (while the app is
  open), but no push is sent. The rest of the business flow is unaffected.
- The mini-app requests the corresponding user permission via
  `VKWebAppAllowNotifications` (VK Bridge). Without that consent, VK rejects
  the push at the API level.
- Push is independent from community messaging (`VK_GROUP_ID` /
  `VK_GROUP_TOKEN`, `messages.send`) and from the per-user
  `notificationsEnabled` DB toggle. Critical events are pushed regardless of
  the per-user toggle; community messaging has its own consent flow.

Example environment entry:

```dotenv
VK_SERVICE_KEY=replace-with-the-mini-app-service-access-key
```

## Metrics access

`METRICS_TOKEN` is optional in development and test. When it is unset there,
`GET /metrics` remains available for local tooling and the existing test suite.

Set `METRICS_TOKEN` to a long, randomly generated secret in production. Metrics
clients must then send it as a bearer token:

```text
Authorization: Bearer <METRICS_TOKEN>
```

If `METRICS_TOKEN` is absent in production, `GET /metrics` returns `404` instead
of exposing service metrics publicly. Missing, malformed, and incorrect bearer
credentials return `403` when a token is configured.

Example environment entry:

```dotenv
METRICS_TOKEN=replace-with-a-long-random-secret
```
