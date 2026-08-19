# Backend environment variables

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
