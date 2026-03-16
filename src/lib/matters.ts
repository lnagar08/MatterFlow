import { prisma } from "@/lib/prisma";
import { getMatterPenaltyInfo } from "@/lib/matter-health";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export async function getFirmMatters(firmId: string) {

  const session = await getServerSession(authOptions);
  
  return prisma.matter.findMany({
    where: {
	  userId: session.user.id,
      firmId,
      archivedAt: null,
      closedAt: null
    },
    include: {
      client: true,
      checklistGroups: {
        include: {
          steps: {
            orderBy: {
              sortOrder: "asc"
            }
          }
        },
        orderBy: {
          sortOrder: "asc"
        }
      },
      checklistSteps: {
        where: {
          groupId: null
        },
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function getMatterById(id: string, firmId: string) {

  const session = await getServerSession(authOptions);
  
  return prisma.matter.findFirst({
    where: {
      id,
	  userId: session.user.id,
      firmId,
      archivedAt: null,
      closedAt: null
    },
    include: {
      client: true,
      checklistGroups: {
        include: {
          steps: {
            orderBy: {
              sortOrder: "asc"
            }
          }
        },
        orderBy: {
          sortOrder: "asc"
        }
      },
      checklistSteps: {
        where: {
          groupId: null
        },
        orderBy: {
          sortOrder: "asc"
        }
      }
    }
  });
}

export function computeMatterFlags(matter: {
  engagementDate: Date;
  lastActivityAt: Date;
  checklistGroups: Array<{
    steps: Array<{ id: string; completed: boolean; dueDaysOffset: number | null; dueAt: Date | null }>;
  }>;
  checklistSteps: Array<{ id: string; completed: boolean; dueDaysOffset: number | null; dueAt: Date | null }>;
}) {
  const info = getMatterPenaltyInfo(matter);
  return { agedOpen: info.agedOpen, stale: info.stale, overdue: info.overdue };
}
