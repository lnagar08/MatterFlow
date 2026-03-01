-- CreateTable
CREATE TABLE "FirmSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "bottleneckDays" INTEGER NOT NULL DEFAULT 7,
    "dueSoonHours" INTEGER NOT NULL DEFAULT 48,
    "penaltyIncludeOverdue" BOOLEAN NOT NULL DEFAULT true,
    "penaltyIncludeBottleneck" BOOLEAN NOT NULL DEFAULT true,
    "penaltyIncludeAging" BOOLEAN NOT NULL DEFAULT false,
    "maxOpenDays" INTEGER,
    "firmId" TEXT NOT NULL,
    CONSTRAINT "FirmSettings_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmSettings_firmId_key" ON "FirmSettings"("firmId");

