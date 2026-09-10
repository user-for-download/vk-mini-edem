# Telegram go / no-go thresholds

**Task:** tg-migration-21.
**Status:** thresholds proposed — sign-off owner required before any cutover
(owner: Product/Operations, TBD).

## Thresholds (all must hold on staging)

| Signal | Source | GO | NO-GO |
|---|---|---|---|
| E2E parity journey | `node e2e/telegram-parity.mjs` | 16/16 green, cleanup ok | any step red |
| Backend contract suites | `packages/contracts` tests | 241/241 | any red |
| Telegram-app suites | `telegram-app` tests | 232/232 (or current green baseline) | any red |
| TG delivery suites | `telegramNotifications` unit + `telegram-notifications` integration | all green | any red |
| Migration dry-run | `scripts/migrate-vk-to-telegram.mjs` | `writes=0`, counts reconciled | any write / mismatch |
| Staging smoke | `scripts/smoke-telegram-deployment.mjs` | 6/6 | any red |
| Auth success | staging login funnel (Telegram client) | ≥ 99% `/auth/telegram` 200 on valid initData over 1h | below, or 5xx > 0 |
| Error rate | backend logs/metrics | 5xx < 0.1% of API requests over 1h | at/above |
| API latency | proxy/metrics | p95 < 500ms on `/trips`, `/bookings` reads | at/above |
| WS stability | server logs | no unexpected 1011/1013 bursts; 4401 only for anonymous sockets | mass drops |
| Notification delivery | inbox sampling | contracted critical events present in recipient inbox | missing events |
| Data reconciliation | migration manifest vs DB counts | exact match | mismatch |
| Rollback readiness | drill (this report) | snapshot verified + restore proven + script guards green | any gap |

## NO-GO triggers (immediate)

- Any `writes > 0` from a dry-run tool.
- Rollback snapshot missing, unverified, or older than the cutover window.
- Missing Product/Legal/Operations approvals for any write migration.
- `ALLOW_DEV_AUTH=true` anywhere near staging/production.
- Bot API background sends enabled without the approved ADR decision record.

## Sign-off

- [ ] Product owner: ______________ date: ______
- [ ] Operations owner: ______________ date: ______
- [ ] Privacy/Legal (if user data moves): ______________ date: ______
