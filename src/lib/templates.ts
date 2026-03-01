import { prisma } from "@/lib/prisma";

export async function getFirmTemplates(firmId: string) {
  return prisma.matterTemplate.findMany({
    where: { firmId },
    include: {
      groups: {
        orderBy: {
          sortOrder: "asc"
        }
      },
      steps: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      sortOrder: "asc"
    }
  });
}
