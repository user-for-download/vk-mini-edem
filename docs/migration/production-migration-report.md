# Production account migration report

**Task:** tg-migration-23
**Date:** 2026-09-10
**Verdict:** **NOT-APPLICABLE** — no production dataset exists.

## 1. Backup

Not required: no production data. The backup/restore path itself is proven
(see `staging-rehearsal-report.md` §1/§4: verified dump + scratch restore
with canary overwrite). `backend/scripts/backup.sh` remains the tool of
record for the day production data appears.

## 2. Migration command

`node scripts/migrate-vk-to-telegram.mjs` (dry-run):

```text
total: 1
independent: 1
conflict: 0
blocked: 0
unsupported: 0
execute: action=report writes=0
```

The single counted identity is a disposable dev-probe Telegram user, not a
production account. `--apply` without approvals refuses (exit 2); the engine
has no link primitive, so no run can produce writes.

## 3. Reconciliation

Source: [`production-reconciliation.json`](./production-reconciliation.json)
(live counts at report time).

| Entity | Count | Plan coverage |
|---|---|---|
| users (all Telegram probe) | 1 | 1 independent |
| trips / bookings / reviews / reports / feedback / notifications | 0 | — (nothing to cover) |
| sessions (refresh tokens) | 1 | sessions are never migrated (re-login after cutover) |

Reconciliation: exact match, zero discrepancies, zero writes.
Threshold per go/no-go: exact match — holds vacuously.

## 4. Conflicts, skipped accounts, rollback readiness

- Conflicts: 0. Skipped: 0. Blocked: 0.
- Rollback readiness: snapshot/restore proven (rehearsal §4);
  `scripts/rollback-telegram-migration.mjs` guards green.
- Unresolved discrepancies blocking deletion: none exist; ВК deletion
  remains blocked by the standing rule (GO required, none recorded).

## 5. Audit trail

This run is recorded via `backend/src/migrations/audit.ts`
(`recordMigrationRun`, kind `dry-run`, writes 0). The journal is the durable
output for every future run — dry or applied.
