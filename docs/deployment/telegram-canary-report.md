# Telegram canary rollout report

**Task:** tg-migration-22
**Date:** 2026-09-10
**Verdict:** **NO-GO / not attempted** (recorded per acceptance: decision with
timestamp, evidence and approver status below).

## Decision

| Field | Value |
|---|---|
| Decision | NO-GO — canary not executed |
| Timestamp | 2026-09-10 |
| Approver | — (no owner signed; sign-off table in `telegram-go-no-go.md` empty) |
| Evidence | this report + rehearsal report + unmet prerequisites list |

## Why not attempted (all must clear before any attempt)

1. **No production host.** No DNS, no TLS, no edge proxy configured.
   Production config is written and ready
   ([`telegram-production-config.md`](./telegram-production-config.md)), not applied.
2. **No production dataset.** Policy (`account-migration-policy.md`): migration
   tooling dry-runs `writes=0`; there are no users to canary onto.
3. **No sign-off.** `telegram-go-no-go.md` requires Product/Operations
   (and Legal if data moves) signatures — none exist.
4. **Bot API background delivery blocked** (ADR) — canary scope would need
   re-confirmation if Product later requires it.

Attempting a "canary" against dev/staging and calling it production would be
dishonest evidence. The staging rehearsal (tg-migration-21) is the closest
real execution:

- backup/restore proven on scratch (canary row overwritten by re-restore);
- migration dry-run `writes=0`, `--apply` refused without approvals (exit 2);
- smoke 5/6 locally (Host-routing check passes only where `TELEGRAM_HOSTS`
  is configured, i.e. staging);
- E2E parity 16/16, backend suites green (241 contracts, 232 telegram-app,
  120+ backend unit, 391/392 integration with one pre-existing failure).

## Preconditions for re-proposing canary

- [ ] Production host + TLS + proxy per `telegram-production-config.md` §2
- [ ] Secrets issued (`TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TOKEN`, `METRICS_TOKEN`)
- [ ] Fresh verified snapshot + manifest
- [ ] All three sign-offs collected
- [ ] Observation window staffed (who watches metrics, who calls rollback)

## Standing rule (unchanged)

No VK deletion work starts before a recorded GO. The VK reference stays
frozen and serving until then.
