/*
  Warnings:

  - Changed the type of `role` on the `FirmMembership` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `role` on the `Invitation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('ADMIN', 'ATTORNEY', 'STAFF', 'READ_ONLY');

-- AlterTable
ALTER TABLE "FirmMembership" DROP COLUMN "role",
ADD COLUMN     "role" "FirmRole" NOT NULL;

-- AlterTable
ALTER TABLE "FirmSettings" ALTER COLUMN "penaltyIncludeAging" SET DEFAULT true,
ALTER COLUMN "penaltyBoxOpenDays" SET DEFAULT 40;

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "role",
ADD COLUMN     "role" "FirmRole" NOT NULL;

-- AlterTable
ALTER TABLE "Matter" ALTER COLUMN "groupProgress" SET DATA TYPE JSONB;
