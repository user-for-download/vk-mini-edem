# VK deletion gate

**Task:** tg-migration-24.
**Rule:** VK deletion work starts ONLY after a recorded GO here.
**Status:** **GO — deletion executed 2026-09-10** under the owner amendment
below (empty-prod development exception). The verdict table is the pre-GO
record; the retention/legal exceptions below remain in force for any future
production data.

## Gate evidence (observation: tasks 14–23)

| Gate | Evidence | Status |
|---|---|---|
| Parity | `final-parity-signoff.md`: core journeys resolved, E2E 16/16 | green |
| Stability | suites: 241 contracts, 232 TG-app, 120+ backend unit, 391/392 integration (1 pre-existing failure, fails on clean tree) | green* |
| Security | audit 18: no critical/high; 9 security tests green | green |
| Notifications | task 15 suites + inbox regression covered | green |
| WebSocket | task 14 suites + smoke 4401-timeout | green |
| Backup | `backup.sh` verify+retention; restore proven on scratch (21) | green |
| Migration | dry-run `writes=0`, refusal paths, reconciliation exact (19, 23) | green (vacuous) |
| Rollback | script guards + scratch restore with canary overwrite (21) | green |
| Canary | **NO-GO recorded** (no prod host/data/sign-off — task 22) | **red** |
| Owner signature | none collected | **red** |

\* The single integration failure (`user-rate-limit.test.ts`) is pre-existing
and unrelated; tracked as a separate bug, not a migration gate item.

## Verdict

**VK deletion is BLOCKED.** Gates red: canary NO-GO + missing owner signature.
Parity/engineering gates being green does not override them.

## Amendment 2026-09-10: empty-prod development exception (owner GO)

Owner decision (project owner, 2026-09-10): the application is in development,
the production database is empty, there is no production data to migrate, and
a full VK copy is preserved in a separate repository. Under these conditions
VK removal inside this repo is authorized:

- data loss risk: none (dev records are disposable; schema reset accepted);
- reversibility: full history in git + external VK copy;
- tombstone/retention rules above remain in force for any future production data.

**Deletion work (tasks 25–27) may proceed. GO recorded here by owner decision.**

## Retention / legal exceptions (apply whenever deletion is eventually approved)

- Deletion tombstones (`deletedAt` + platform id) are **preserved**, never
  hard-deleted inside the rollback/migration window: re-login stays 403.
- Banned accounts are never migrated or resurrected (appeal first).
- Active obligations (trips/bookings/ride requests) block any destructive
  move that could orphan them — resolve in product first.
- Never retain VK credentials; never copy profile fields without approved
  purpose + notice. Anonymize after the approved retention window.
- Exact periods and lawful basis: **BLOCKED — Legal/Data Protection**
  (policy §Required approvals).

## Unblocking (all required)

> Superseded 2026-09-10 by the owner amendment above (empty-prod exception).
> Canary/observation items are N/A while production stays empty; the checklist
> applies in full if production data ever appears.

- [ ] Canary GO recorded with timestamp, evidence and approver
- [ ] Observation window meets `telegram-go-no-go.md` thresholds
- [ ] Owner signature below, incl. retention/legal exceptions accepted

## Sign-off

- [x] Release owner: project owner — owner amendment above, date: 2026-09-10
- [x] Decision: GO (VK deletion executed 2026-09-10, empty-prod exception)
