# Account migration policy: VK to Telegram

**Effective date:** 2026-09-09
**Current decision:** No production migration or VK↔Telegram linking for this cutover

## Applicability

The project has no production accounts or production data to transfer. Therefore:

- `production account migration` = **not applicable**;
- `VK↔TG linking` = **not applicable**;
- dev, seed, fixture and test records = **disposable non-production data**.

Example: a seeded VK user and a Telegram user with the same name are two unrelated identities. Resetting the database may remove both records without a migration or recovery promise.

## Rules if production data appears before cutover

The first production record changes the operating mode from **disposable** to **migration-controlled**:

1. Pause VK deletion, database resets and irreversible cleanup.
2. Keep VK available for affected users; do not force an unverified Telegram merge.
3. Take and verify a restorable database snapshot.
4. Inventory source users and dependent data: active trips/bookings/requests, reviews, reports, feedback, notifications, consent, banned state and deletion tombstones.
5. Obtain the Product and Legal approvals marked `BLOCKED` below.
6. Produce a dry-run mapping report and reconcile counts before any write migration.

Until approved, Telegram creates or uses only an independently authenticated account keyed by `telegramUserId`.

## Matching and conflict handling

| Input/state | Policy | Outcome |
|---|---|---|
| No approved source mapping | No automatic match | Independent Telegram account |
| Explicit authenticated linking flow approved for the release | Match only the selected source account | Audited link; no silent merge |
| Duplicate candidates, reused identity or inconsistent source ownership | Never choose automatically | `conflict` queue; manual review |
| Banned source account | Preserve restriction | No migration until an approved appeal/outcome |
| Deleted/tombstoned source account | Preserve terminal state | No resurrection or data merge |
| Active trip, booking or ride request | Preserve obligation | No deletion or merge that can orphan the obligation |
| Unsupported VK-only capability or malformed record | Preserve source evidence | `unsupported` queue; product/support decision |
| Name, avatar, email or phone resemblance only | Not an identity proof | No link |

Illustrative dry-run result:

```text
matched: 0
conflict: 0
unsupported: 0
action: no migration required (no production dataset)
```

## Data retention and anonymization

### Current state

Non-production data may be reset, reseeded or deleted. It must not be exported as a production migration dataset.

### Future production state

- Retain only the minimum source snapshot, mapping decisions and audit trail required for the approved migration, support and rollback windows.
- Remove or anonymize source personal data after the approved retention window and after active obligations are resolved.
- Never retain VK credentials for convenience. Do not copy unrelated profile fields into Telegram without an approved purpose and notice.
- Preserve deletion/tombstone semantics: deletion must not silently recreate an account on Telegram.
- Record who approved a manual mapping and why; do not expose migration evidence to ordinary users.

Exact retention periods, anonymization fields and lawful basis are **BLOCKED — Legal/Data Protection**.

## Unsupported users and conflicts

Users in `unsupported` or `conflict` state must not be silently dropped or merged. Keep the source account unchanged, record a non-sensitive reason code, and route the case to the approved support owner.

The Product Owner must define the user experience, review SLA and final outcomes (migrate, remain on VK, or delete/anonymize). This is **BLOCKED — Product/Operations**. Until resolved, the safe default is “remain on VK; no destructive action.”

## Rollback

Before any future production migration:

1. Capture a verified restore point and migration manifest.
2. Run a dry-run and reconcile source, target, conflict and unsupported counts.
3. Define a write-free or controlled-write interval for cutover.
4. If validation fails, stop the cutover and restore the snapshot or deploy a schema-compatible hotfix.
5. Invalidate affected sessions, restore VK availability, and verify trips, bookings, requests, notifications and account lifecycle states.
6. Reconcile the manifest and document residual cases before declaring rollback complete.

An image rollback alone is insufficient when database changes are forward-only. Do not delete VK data until the rollback window and verification sign-off are complete.

## Required approvals before policy activation

- **BLOCKED — Product:** need for VK↔TG linking, matching UX, unsupported-user outcomes and conflict-review SLA.
- **BLOCKED — Legal/Data Protection:** notice/consent, lawful basis, cross-platform transfer, retention, anonymization and deletion requirements.
- **BLOCKED — Operations:** named migration owner, support escalation path, rollback approver and production reconciliation sign-off.

These approvals are not required for the current no-production-data cutover; they become mandatory immediately if production data is introduced.
