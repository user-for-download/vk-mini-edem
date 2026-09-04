-- Drop verificationStatus: VK-authed users are auto-verified, so the
-- "pending" / "none" / "rejected" state machine is no longer needed.
-- Keep `isVerified` and `verifiedAt` as the single "user came through VK" marker.

-- Backfill: any pre-existing rows that were not marked verified become verified.
-- Real prod data is overwhelmingly `approved` already, but be defensive on the
-- edge cases (none/pending/rejected from old test fixtures or hand-seeded rows).
UPDATE "User"
SET "isVerified" = TRUE,
    "verifiedAt" = COALESCE("verifiedAt", NOW());

-- Default flips in the same migration so new rows stay verified.
ALTER TABLE "User" ALTER COLUMN "isVerified" SET DEFAULT TRUE;

-- Drop the column.
ALTER TABLE "User" DROP COLUMN "verificationStatus";
