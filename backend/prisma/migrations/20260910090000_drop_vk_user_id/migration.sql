-- Drop VK identity column (tg-migration-26). Dev data reset accepted by owner.
DROP INDEX IF EXISTS "User_vkUserId_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "vkUserId";
