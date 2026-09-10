# VK documentation removal report

**Task:** tg-migration-27 (executed 2026-09-10).
**Rule applied:** live docs describe Telegram-only production accurately;
migration/security history explicitly retained as archive.

## Rewritten to Telegram-only

| File | Change |
|---|---|
| `README.md` | Full rewrite: title, features (no VK DM/push/VKUI), structure (`telegram-app/`), dev commands (`:3012`, npm), env example, API table (`/auth/telegram`), security (HMAC/TTL, no vkUserId disclosure), CSP `frame-ancestors 'self'`, tech stack, deploy (Telegram proxy reqs), env table, Telegram Mini Apps requirements instead of VK console |
| `MEMORY.md` | Project/Runtime/Authentication sections → Telegram; VK Integration/DM/Push sections → removal stubs with TG pointers; dated verification history kept as archive |
| `e2e/README.md` | Telegram-only (done in 25): prereqs, flow, determinism, artifacts |
| `docs/api/feedback.md` | Appeal: TG initData contract, errors, limits |
| `docs/api/account.md`, `docs/api/admin.md` | Tombstone/ban/appeal identity → `telegramUserId` |
| `docs/deployment/production-checklist.md` | Replaced with pointer stub → Telegram deployment docs |
| `docs/deployment/telegram-staging-checklist.md` | Post-removal reality (no VK branches/vars) |
| `docs/deployment/liquidity-safety-rollback.md` | E2E step → `telegram-parity.mjs` |
| `.github/workflows/ci.yml` | Telegram tests, TG dev server (`:3012`), TG E2E, compose dummies |

## Retained as archive (explicit)

- `docs/migration/*` (baseline, parity matrix, contracts, runbooks, reports) —
  dated migration evidence;
- `docs/adr/*` — Bot API decision record;
- `docs/security/telegram-migration-audit.md` — audit evidence;
- `MEMORY.md` dated verification entries (pre-removal test counts).

## Link/reference check

- No live references to `mini-app/`, `full-cycle.mjs`, `liquidity-safety.mjs`,
  `/auth/vk`, `vkUserId`, `VK_APP_SECRET` outside the archive set above
  (verified by repo search at 28).
