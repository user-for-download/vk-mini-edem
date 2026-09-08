-- DropIndex
DROP INDEX "User_deletedAt_idx";

-- AlterTable
ALTER TABLE "Car" ALTER COLUMN "plate" DROP NOT NULL;
