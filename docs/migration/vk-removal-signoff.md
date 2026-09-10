# VK removal signoff

**Task:** tg-migration-28.
**Date:** 2026-09-10.
**Decision:** **GO — VK removal executed** under gate amendment 24
(empty-prod + external VK copy + owner decision 2026-09-10).

## What was removed

- Frontend: `mini-app/` (38M), workspace/manifests/`@vkontakte/*`,
  Dockerfile steps, VK static serving, CI legs, bundle/format entries,
  VK E2E (`full-cycle`, `liquidity-safety`), e2e docs.
- Backend: `/auth/vk`, `vkSign`/`vkProfile`, `vkPush`/`vkMessenger`,
  VK branches (bookings DM, notifications push, appeal), `includeVkUserId`,
  VK DTOs (`authRequestSchema`, `feedbackAppealDtoSchema`), `VK_*` env/compose,
  VK tests (10 files), VK seed, `vkUserId` column (migration
  `20260910090000_drop_vk_user_id`).
- Docs: README/MEMORY/API/deployment → Telegram-only; history retained
  as archive (`docs/migration/*`, `docs/adr/*`, audit).

## Evidence

- `telegram-final-verification.md`: all gates green (1 pre-existing failure).
- `repository-vk-scan.txt`: no executable VK references.
- Full VK copy preserved in a separate repository (owner-confirmed).

## Residual

- Dev database migrated; running dev backend (`:3011`) is stale —
  redeploy from this tree.
- Open product decisions unchanged (Bot API delivery, participant contact,
  support destination).

## Sign-off

- [x] Project owner: GO executed 2026-09-10 (empty-prod exception).
