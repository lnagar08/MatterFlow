import { NextResponse } from "next/server";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { getCurrentUserContext } from "@/lib/firm-access";
import { getFirmSettings } from "@/lib/firm-settings";
import { computeMatterFlags } from "@/lib/matter-flags";
import { prisma } from "@/lib/prisma";

type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  const context = await getCurrentUserContext();
  const membership = context?.membership;
  if (!membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [settings, matters] = await Promise.all([
    getFirmSettings(membership.firmId),
    prisma.matter.findMany({
      where: {
        userId: userid,
        archivedAt: null,
        closedAt: null
      },
      include: { 
        checklistGroups: {
          include: {
            steps: true
          }
        },
        checklistSteps: {
          where: { groupId: null }
        }
      }
    })
  ]);

  const count = matters.reduce((sum, matter) => {
    const flags = computeMatterFlags(
      {
        createdAt: matter.createdAt,
        updatedAt: matter.updatedAt,
        engagementDate: matter.engagementDate,
        closedAt: matter.closedAt,
        groups: matter.checklistGroups.map((group) => ({
          id: group.id,
          title: group.title,
          sortOrder: group.sortOrder,
          expectedDurationDays: group.expectedDurationDays
        })),
        groupProgress: matter.groupProgress,
        steps: [...matter.checklistGroups.flatMap((group) => group.steps), ...matter.checklistSteps].map((step) => ({
          id: step.id,
          label: step.label,
          completed: step.completed,
          completedAt: step.completedAt,
          dueDaysOffset: step.dueDaysOffset,
          dueAt: step.dueAt,
          sortOrder: step.sortOrder,
          groupId: step.groupId,
          updatedAt: step.updatedAt
        }))
      },
      {
        bottleneckNoProgressDays: settings.bottleneckNoProgressDays,
        noMovementDays: settings.noMovementDays,
        bottleneckDays: settings.bottleneckDays,
        defaultGroupExpectedDays: settings.defaultGroupExpectedDays,
        groupGraceDays: settings.groupGraceDays,
        groupTimingEnabled: settings.groupTimingEnabled,
        agingDays: settings.agingDays,
        dueSoonHours: settings.dueSoonHours,
        atRiskStageWindowDays: settings.atRiskStageWindowDays,
        penaltyBoxOpenDays: settings.penaltyBoxOpenDays,
        penaltyIncludeOverdue: settings.penaltyIncludeOverdue,
        penaltyIncludeAging: settings.penaltyIncludeAging
      }
    );
    return sum + (flags.isPenaltyBox ? 1 : 0);
  }, 0);

  return NextResponse.json({ count });
}
