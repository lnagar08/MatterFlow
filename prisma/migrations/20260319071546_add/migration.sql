-- AlterTable
ALTER TABLE "User" ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "permissions" JSONB DEFAULT '{}';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
