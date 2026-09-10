# Account migration runbook: VK → Telegram

**Policy:** [`account-migration-policy.md`](./account-migration-policy.md)
**Tooling:** `backend/src/migrations/telegramAccountMigration.ts`,
`backend/src/migrations/runner.ts`, `scripts/migrate-vk-to-telegram.mjs`
**Status:** no production dataset — every run is expected to report
`no migration required (no production dataset)` with zero writes.

## 0. Preconditions

- [ ] Confirm whether a production dataset exists. If not — run §1 only.
- [ ] If the first production record appeared: STOP, switch to §2
      (mode changes from disposable to migration-controlled).
- [ ] `DATABASE_URL` points at the intended database (the command refuses
      to run without it).

## 1. Routine dry-run (current mode)

```bash
node scripts/migrate-vk-to-telegram.mjs
```

Expected output: `total: N` with all rows `independent`, or `total: 0`
with `action: no migration required (no production dataset)`.
`execute: action=report writes=0` always. Non-zero writes never happen —
the engine has no link primitive by design.

## 2. Production-data-appeared mode (all steps mandatory, in order)

1. **Freeze:** pause VK deletion, database resets and irreversible cleanup.
   Keep VK available; do not force an unverified Telegram merge.
2. **Backup:** `backend/scripts/backup.sh` (`pg_dump -F c` + verify +
   14-day retention). Record the dump name as the restore point.
   Do not prune old dumps until the new backup is verified.
3. **Inventory:** run the dry-run (§1), save the report as the migration
   manifest. Reconcile: `total = independent + conflict + blocked + unsupported`.
4. **Approvals:** obtain Product, Legal/Data Protection and Operations
   sign-off (see policy §Required approvals). No writes before all three.
5. **Apply attempt:**
   ```bash
   node scripts/migrate-vk-to-telegram.mjs --apply \
     --approve-product --approve-legal --approve-operations
   ```
   Without all flags the command exits 2 (`refused`). With flags it still
   performs zero writes (linking flow is a separate product build) and
   exports the conflict/unsupported queues for manual review.
6. **Conflict/unsupported handling:** source rows stay unchanged; each case
   carries a non-sensitive reason code (see `reason` in the plan entries).
   Route to the support owner; outcomes are migrate / remain on VK /
   delete-anonymize — decided by Product, executed manually.
7. **Banned/deleted sources:** never migrate, never resurrect. Banned →
   appeal first; tombstoned → terminal.
8. **Obligations:** active trips/bookings/ride requests block any move that
   could orphan them. Resolve obligations first (complete/cancel in product),
   then re-run the dry-run.
9. **Retention:** keep only the snapshot, manifest and audit trail for the
   approved window; anonymize after obligations resolve. Never retain VK
   credentials; do not copy profile fields without approved purpose+notice.

## 3. Rollback

1. Stop the cutover on first validation failure.
2. Restore the §2.2 snapshot (`pg_restore`); forward-only migrations are
   not undone by image rollback alone.
3. Invalidate affected sessions, restore VK availability.
4. Verify trips, bookings, requests, notifications and account lifecycle.
5. Reconcile the manifest; document residual cases before sign-off.
6. Do not delete VK data until the rollback window and verification
   sign-off are complete.

## 4. Verification after any run

- `writes=0` in every execution result (until a link primitive ships
  with its own approved runbook section).
- Rerun determinism: same data → byte-identical report (covered by
  `backend/tests/integration/telegram-account-migration.test.ts`).
- No duplicate accounts (upsert by unique platform id, P2002-retry),
  no orphaned ownership (obligations → conflict, never moved),
  no unauthorized linking (no link primitive exists).
