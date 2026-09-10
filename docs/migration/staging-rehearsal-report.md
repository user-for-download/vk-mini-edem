# Staging rehearsal report: migration + rollback

**Task:** tg-migration-21
**Date:** 2026-09-10
**Scope:** rehearsal on the dev stack (production dataset does not exist —
all runs expectedly report `no migration required` with zero writes).

## 1. Backup

| Step | Command | Result |
|---|---|---|
| Dump dev DB (custom format) | `docker exec vk-mini-edem-db-dev pg_dump -U edem -d edem -F c -f /tmp/rehearsal.dump` | ok |
| Verify archive | `pg_restore --list /tmp/rehearsal.dump` | valid archive |
| Manifest counts | `User/Trip/Booking/Notification` | `1/0/0/0` (one leftover probe user `9800101`) |

## 2. Migration dry-run

`node scripts/migrate-vk-to-telegram.mjs` (task 19, re-run during rehearsal):

```text
total: 1
independent: 1
conflict: 0
blocked: 0
unsupported: 0
execute: action=report writes=0
```

`--apply` without flags → `refused`, exit 2. Zero writes confirmed.

## 3. Telegram smoke

`node scripts/smoke-telegram-deployment.mjs` against dev backend (task 20):

- `health/live` 200, `health/ready` 200 (db + migrations applied)
- `/auth/telegram` forged initData → 401 (error shape, no 500)
- `/auth/vk` forged params → 401 (dev secret configured; 503 path unit-covered)
- WS `/api/v1/ws` upgrade → anonymous socket closed **4401** (auth timeout)
- Host-routing check fails loudly locally (dev backend has no `TELEGRAM_HOSTS`)
  — passes on staging where the host is configured.

## 4. Rollback drill (evidence)

Performed inside the db container (same `pg_restore` commands as
`scripts/rollback-telegram-migration.mjs`; local runners need PG clients):

1. `createdb edem_rehearsal` (scratch, dev DB untouched).
2. `pg_restore --clean --if-exists -d edem_rehearsal` → counts `1/0/0/0`,
   match manifest.
3. Canary: `INSERT User(name='Canary')` → count `2`.
4. Re-restore → count `1`, `Canary` rows `0` — restore overwrites post-snapshot writes.
5. `dropdb edem_rehearsal`, dump removed.

**Conclusion:** restore path proven to return the exact snapshot state.
Rollback script guards verified: no `DATABASE_URL` → exit 1, no `--dump` →
exit 1, refuse-without-approvals path exit 2 (task 19 evidence).

## 5. Monitoring checks (staging owner to re-run)

- Logs: json-file rotation 10m×3 (compose `x-logging`); no bodies/tokens/initData.
- Metrics: `METRICS_TOKEN` set → `/metrics` scrapeable.
- Sentry: backend `SENTRY_DSN` + `VITE_SENTRY_DSN` build-time.
- WS stability: 4401-timeout smoke + `ws-limits`/`ws-manager` suites green.
- Notification delivery: `telegramNotifications` unit + integration suites green.
- Auth success baseline: E2E `telegram-parity.mjs` 16/16 on dev.

## 6. Residual notes

- Dev DB contained one leftover probe identity (`9800101`) — disposable
  non-production data, left in place (policy: dev records are disposable).
- Full `execute` path of the rollback script requires PG clients on the
  runner; staging runners must have `postgresql-client` installed.
