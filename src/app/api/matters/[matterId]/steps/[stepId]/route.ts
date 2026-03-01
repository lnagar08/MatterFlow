import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getCurrentUserContext } from "@/lib/firm-access";
import { parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    matterId: string;
    stepId: string;
  }>;
};

type Payload = {
  completed?: boolean;
  dueAt?: string | null;
};

export async function PATCH(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { matterId, stepId } = await params;
  const payload = (await request.json()) as Payload;

  const hasCompleted = typeof payload.completed === "boolean";
  const hasDueAt = payload.dueAt === null || typeof payload.dueAt === "string";

  if (!hasCompleted && !hasDueAt) {
    return NextResponse.json(
      { error: "Provide completed (boolean) and/or dueAt (ISO date string or null)." },
      { status: 400 }
    );
  }

  const step = await prisma.checklistStep.findFirst({
    where: {
      id: stepId,
      matterId,
      matter: {
        firmId: context.membership.firmId
      }
    }
  });

  if (!step) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  let dueAt: Date | null | undefined;
  if (payload.dueAt !== undefined) {
    if (payload.dueAt === null || payload.dueAt === "") {
      dueAt = null;
    } else {
      dueAt = new Date(payload.dueAt);
      if (Number.isNaN(dueAt.getTime())) {
        return NextResponse.json({ error: "dueAt must be a valid date string or null." }, { status: 400 });
      }
    }
  }

  const stepUpdateData: { completed?: boolean; completedAt?: Date | null; dueAt?: Date | null } = {};
  if (hasCompleted) {
    stepUpdateData.completed = payload.completed;
    stepUpdateData.completedAt = payload.completed ? new Date() : null;
  }
  if (payload.dueAt !== undefined) {
    stepUpdateData.dueAt = dueAt;
  }

  await prisma.$transaction(async (tx) => {
    await tx.checklistStep.update({
      where: { id: stepId },
      data: stepUpdateData
    });

    const [matterWithProgress, groups] = await Promise.all([
      tx.matter.findUnique({
        where: { id: matterId },
        select: {
          engagementDate: true,
          groupProgress: true
        }
      }),
      tx.checklistGroup.findMany({
        where: { matterId },
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            orderBy: { sortOrder: "asc" }
          }
        }
      })
    ]);

    const groupProgress = parseGroupProgress(matterWithProgress?.groupProgress);
    const currentGroup = groups.find((group) => group.steps.some((groupStep) => !groupStep.completed));
    if (currentGroup && !groupProgress[currentGroup.id]) {
      const nowIso = new Date().toISOString();
      const start = matterWithProgress?.engagementDate && matterWithProgress.engagementDate < new Date()
        ? matterWithProgress.engagementDate.toISOString()
        : nowIso;
      groupProgress[currentGroup.id] = { startedAt: start };
    }

    await tx.matter.update({
      where: { id: matterId },
      data: {
        lastActivityAt: new Date(),
        groupProgress
      }
    });
  });

  revalidatePath(`/matters/${matterId}`);
  revalidatePath("/home");
  revalidatePath("/penalty-box");

  return NextResponse.json({
    ok: true,
    step: {
      id: step.id,
      completed: hasCompleted ? payload.completed : step.completed,
      dueAt: payload.dueAt === undefined ? step.dueAt : dueAt?.toISOString() ?? null
    }
  });
}
