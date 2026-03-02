-- AlterTable
ALTER TABLE "FirmSettings" ADD COLUMN "bottleneckNoProgressDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "FirmSettings" ADD COLUMN "penaltyBoxOpenDays" INTEGER NOT NULL DEFAULT 60;

-- AlterTable
ALTER TABLE "TemplateGroup" ADD COLUMN "expectedDurationDays" INTEGER;

-- AlterTable
ALTER TABLE "ChecklistGroup" ADD COLUMN "expectedDurationDays" INTEGER;

-- AlterTable
ALTER TABLE "ChecklistStep" ADD COLUMN "completedAt" TIMESTAMP(3);

