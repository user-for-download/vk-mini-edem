# Backend environment variables

## Numeric values

Explicit numeric settings must be positive safe integers. Zero, negative,
fractional, partially numeric, and out-of-range values stop startup with the
variable name instead of silently changing runtime behavior. Unset variables use
the defaults from `src/env.ts`.

This applies to `PORT`/`BACKEND_PORT`, `JWT_ACCESS_TTL_SECONDS`,
`JWT_REFRESH_TTL_SECONDS`, all `*_RATE_WINDOW_MS` and `*_RATE_MAX` settings, and
the optional `VK_GROUP_ID`. An unset `VK_GROUP_ID` disables community messaging;
an explicitly configured value must be positive.

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
