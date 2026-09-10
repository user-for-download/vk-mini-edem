# VK frontend removal report

**Task:** tg-migration-25
**Status:** **EXECUTED 2026-09-10** under gate amendment 24 (empty-prod +
external VK copy + owner GO). This file scoped the removal; all rows below
are done. Verification evidence inline.

## Inventory (what GO will delete)

| Area | References to remove |
|---|---|
| Workspace | `mini-app/` (38M source), root `package.json`: workspaces entry, `dev:frontend`, `build`/`clean`/`lint` mini-app legs, `@vkontakte/*` deps |
| Backend image | `backend/Dockerfile`: `COPY mini-app/package.json`, `COPY mini-app`, `RUN cd mini-app && npm run build`, `COPY mini-app/dist` |
| Backend serving | `backend/src/app.ts`: `vkDistPath`/`vkStatic`/`vkIndexHtml` host-routing branches → Telegram-only static (keep `TELEGRAM_HOSTS` gate during transition or drop it per decision) |
| CI | `.github/workflows/ci.yml`: mini-app test job, mini-app dev-server E2E leg |
| Scripts | `scripts/check-bundle.mjs` (mini-app dist), `scripts/format-check.mjs` (mini-app paths), `e2e/full-cycle.mjs` + `liquidity-safety.mjs` (VK flows; keep e2e harness) |
| Lockfile | regenerate `package-lock.json` (`npm ci` must stay green) |
| Docs | `e2e/README.md` VK sections, baseline matrix links (history stays) |

Out of scope for 25 (separate decisions): backend VK integrations
(`vkSign`/`vkPush`/`vkMessenger`, `/auth/vk`) — needed until VK clients
are fully offboarded; `webapp` admin (platform-shared).

## Verification checklist (run at GO, before merging removal)

- [ ] `grep -rn 'mini-app' --include='*.json,yml,ts,mjs,sh'` returns only history/docs
- [ ] No `@vkontakte/*` in manifests/lockfile
- [ ] `npm ci`, `tsc`, backend + telegram-app suites green
- [ ] Docker backend build succeeds without mini-app context
- [ ] Staging smoke 6/6 on Telegram host; VK host answers 404/TG fallback per decision
- [ ] No `mini-app/dist` in image; bundle check passes

## Execution evidence (2026-09-10)

- `mini-app/` deleted (38M); workspace/manifests/Dockerfile/CI/scripts/e2e updated
- `package-lock.json`: vk packages dropped (-4153/+465), stale workspace entry pruned
- `npm install` green; `tsc` clean (telegram-app, backend, contracts)
- backend unit 124/124, telegram-app 232/232
- `docker compose config` still to re-validate at final verification (28)

## Unblock conditions

~~`vk-deletion-gate.md`: canary GO + threshold window + owner signature.~~
Superseded by gate amendment 24 (empty-prod exception, owner GO 2026-09-10).
