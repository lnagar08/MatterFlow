import { prisma } from "@/lib/prisma";
import { getMatterPenaltyInfo } from "@/lib/matter-health";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}
export async function getFirmMatters(firmId: string) {

  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  return prisma.matter.findMany({
    where: {
	  userId: userid,
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

 
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
   const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  return prisma.matter.findFirst({
    where: {
      id,
	    userId: userid,
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
