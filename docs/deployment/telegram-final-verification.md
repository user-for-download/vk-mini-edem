# Telegram final verification (deletion commit)

**Task:** tg-migration-28. **Date:** 2026-09-10.

## Static gates

| Check | Result |
|---|---|
| `npm run lint` (typecheck all workspaces) | pass |
| `npm run format:check` | pass (frozen docs whitespace-trimmed, zero semantic change) |
| `npm run build` (contracts → backend → telegram-app → webapp) | pass |
| `npm run bundle:check` | pass — telegram-app 173.9 KiB, webapp 181.0 KiB initial gzip |
| `docker compose config` | pass (Telegram vars required, no VK vars) |

## Test gates

| Suite | Result |
|---|---|
| contracts | 19 files, 234/234 |
| backend unit | 13 files, 102/102 |
| backend integration | 372/373 (1 pre-existing `user-rate-limit` failure, fails on clean tree) |
| telegram-app | 28 files, 232/232 |
| E2E `telegram-parity.mjs` | 16/16 green on pre-deletion tree; deletion touched no TG UI/API paths it covers (rerun recommended after backend redeploy) |

## Live gates (fresh production build, temp port :3021)

| Check | Result |
|---|---|
| `health/live`, `health/ready` | 200 |
| `/auth/telegram` forged | 401 (error shape) |
| `/auth/vk` | **404 JSON (route gone)** |
| WS `/api/v1/ws` upgrade + anonymous close | **4401** |

## VK scan

`docs/migration/vk-removal-signoff.md` gate + `repository-vk-scan.txt`:
no executable VK code/config/dependency; remaining matches reviewed
(self-checks, absence assertions, scrub fragment, history).

## Note on shared dev resources

The dev database (`:5433`) was migrated (`vkUserId` dropped) and the running
dev backend (`:3011`, pre-deletion build) is stale — restart/redeploy it from
this tree before further dev/E2E runs.
