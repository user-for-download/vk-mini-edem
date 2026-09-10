# ADR: Telegram account migration policy

**Date:** 2026-09-09
**Status:** Accepted — migration not applicable at current cutover
**Scope:** VK reference implementation → Telegram Mini App

## Decision

- There are currently no production accounts or production records to migrate.
- Production account migration and VK↔Telegram identity linking are therefore **not applicable** for this cutover.
- Dev, seed, fixture and test records are disposable non-production data. They may be reset or discarded; display name, avatar or other profile similarity must never be used to merge identities.
- New Telegram users are identified by the validated Telegram platform identity (`telegramUserId`). No VK credential is requested or retained for this cutover.
- The migration owner is the **Product Owner**, with the Engineering Owner responsible for implementation and rollback execution if production data is introduced before cutover.

## Consequences

### Before cutover

If production data appears before the Telegram cutover:

1. Stop any destructive VK removal or data reset.
2. Freeze the affected release and declare a migration workstream.
3. Inventory accounts, active obligations, consent, deletion/tombstone state and notification preferences.
4. Obtain the blocked product/legal decisions below before matching, exporting or deleting records.
5. Create a tested migration snapshot and dry-run report; no automatic VK↔TG merge is allowed.

Until those gates pass, production users remain on the existing supported path and Telegram accounts remain separate.

### Identity and conflicts

| Case | Required behavior |
|---|---|
| Telegram identity has no approved VK mapping | Create/use the Telegram account only. Do not infer a VK match. |
| A future, verified mapping exists | Link only through an explicit, authenticated flow approved by Product and Legal. |
| Multiple VK candidates or one identity maps to multiple accounts | Mark `conflict`, block automatic merge, and route to manual support review. |
| Unsupported platform/account state, banned user, deleted tombstone or active obligation | Do not migrate automatically; preserve the source state and route to the defined support path. |
| Name/avatar/email/phone match only | Treat as unsupported evidence; never merge. |

## Rejected alternatives

- **Match by display name or avatar:** unsafe and not sufficiently identifying.
- **Bulk-copy dev/seed/test data:** unnecessary; those records are disposable.
- **Keep VK credentials indefinitely:** increases security and privacy scope without a current migration need.
- **Delete VK data immediately:** unsafe if production data appears before cutover or rollback evidence is incomplete.

## Retention, deletion and rollback

- Non-production records may be reset according to the disposable environment procedure; they are not migration inputs.
- If production records are introduced, retain only the minimum source snapshot and migration audit evidence needed for the approved migration, support, legal and rollback windows. Exact duration is **BLOCKED** pending Legal/Data Protection approval.
- After an approved successful cutover, apply the approved retention schedule. Account deletion must result in the existing anonymized/tombstone behavior where required by the product lifecycle; raw credentials and unnecessary identity attributes must not be retained.
- Rollback is a release/data operation, not an image-only revert. Preserve a verified pre-migration snapshot, stop writes or use a controlled dual-write/read-only window, restore the snapshot or deploy a schema-compatible hotfix, invalidate affected sessions, and verify auth plus active obligations before reopening traffic.
- Do not claim rollback completion until reconciliation confirms no booking, trip, payment, notification or deletion state was silently lost.

## Blocked decisions

- **BLOCKED — Product:** whether VK↔Telegram linking will ever be required, and the user-visible account recovery/matching flow.
- **BLOCKED — Legal/Data Protection:** lawful basis, user notice/consent, cross-platform identity transfer, retention period, deletion/anonymization schedule and support access to migration evidence.
- **BLOCKED — Product/Operations:** owner, SLA and verification method for manual conflict/unsupported-user review if production data appears.

These blockers do not prevent the current Telegram cutover because no production account or data migration is required.
