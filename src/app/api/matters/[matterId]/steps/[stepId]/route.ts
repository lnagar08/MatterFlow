import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getCurrentUserContext } from "@/lib/firm-access";
import { buildGroupProgressPayload, parseGroupProgress } from "@/lib/group-progress";
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
  completedAt?: string | null;
};

function completionBaseline(step: {
  completedAt: Date | null;
  dueAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return (
    step.completedAt?.getTime() ??
    step.dueAt?.getTime() ??
    null
  );
}

export async function PATCH(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { matterId, stepId } = await params;
  const payload = (await request.json()) as Payload;

  const hasCompleted = typeof payload.completed === "boolean";
  const hasDueAt = payload.dueAt === null || typeof payload.dueAt === "string";
  const hasCompletedAt = payload.completedAt === null || typeof payload.completedAt === "string";

  if (!hasCompleted && !hasDueAt && !hasCompletedAt) {
    return NextResponse.json(
      { error: "Provide completed (boolean), completedAt (ISO date string or null), and/or dueAt (ISO date string or null)." },
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

  let completedAt: Date | null | undefined;
  if (payload.completedAt !== undefined) {
    if (payload.completedAt === null || payload.completedAt === "") {
      completedAt = null;
    } else {
      completedAt = new Date(payload.completedAt);
      if (Number.isNaN(completedAt.getTime())) {
        return NextResponse.json({ error: "completedAt must be a valid date string or null." }, { status: 400 });
      }
    }
  }

  if (payload.completedAt !== undefined && payload.completed === false && completedAt !== null) {
    return NextResponse.json({ error: "Cannot set a completed date when completed is false." }, { status: 400 });
  }

  const stepUpdateData: { completed?: boolean; completedAt?: Date | null; dueAt?: Date | null } = {};
  if (hasCompleted) {
    stepUpdateData.completed = payload.completed;
    stepUpdateData.completedAt = payload.completed ? new Date() : null;
  }
  if (payload.completedAt !== undefined) {
    stepUpdateData.completedAt = completedAt;
    if (payload.completed === undefined && completedAt !== null) {
      stepUpdateData.completed = true;
    }
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
    if (currentGroup) {
      const currentGroupOrder = currentGroup.sortOrder;
      const currentGroupFirstStep = [...currentGroup.steps].sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const firstStepCompletedAt = currentGroupFirstStep ? completionBaseline(currentGroupFirstStep) : null;
      const previousStage = [...groups]
        .filter((group) => group.sortOrder < currentGroupOrder)
        .sort((a, b) => b.sortOrder - a.sortOrder)[0];
      const previousStageLastStep = previousStage
        ? [...previousStage.steps]
            .filter((step) => step.completed)
            .sort((a, b) => b.sortOrder - a.sortOrder)[0]
        : null;
      const previousStageLastStepCompletedAt = previousStageLastStep
        ? completionBaseline(previousStageLastStep)
        : null;
      const previousCompletionTimes = groups
        .filter((group) => group.sortOrder < currentGroupOrder)
        .flatMap((group) => group.steps)
        .filter((groupStep) => groupStep.completed && groupStep.completedAt)
        .map((groupStep) => groupStep.completedAt!.getTime());
      const fallbackStart = typeof previousStageLastStepCompletedAt === "number"
        ? new Date(Math.min(previousStageLastStepCompletedAt, Date.now()))
        : typeof firstStepCompletedAt === "number"
          ? new Date(Math.min(firstStepCompletedAt, Date.now()))
        : previousCompletionTimes.length > 0
          ? new Date(Math.max(...previousCompletionTimes))
          : (() => {
              const currentGroupCompletedTimes = currentGroup.steps
                .filter((groupStep) => groupStep.completed && groupStep.completedAt)
                .map((groupStep) => groupStep.completedAt!.getTime())
                .sort((a, b) => a - b);
              if (currentGroupCompletedTimes.length > 0) {
                return new Date(Math.min(currentGroupCompletedTimes[0], Date.now()));
              }
              const currentGroupFirstStepCreated = currentGroup.steps
                .map((groupStep) => groupStep.createdAt.getTime())
                .sort((a, b) => a - b)[0];
              if (currentGroupFirstStepCreated) {
                return new Date(currentGroupFirstStepCreated);
              }
              return new Date();
            })();

      const existingStart = groupProgress[currentGroup.id]?.startedAt
        ? new Date(groupProgress[currentGroup.id].startedAt)
        : null;
      const needsInitialize = !existingStart || Number.isNaN(existingStart.getTime());
      const needsRepair =
        !!existingStart &&
        !Number.isNaN(existingStart.getTime()) &&
        existingStart.getTime() > Date.now() + 60_000;

      if (needsInitialize || needsRepair) {
        groupProgress[currentGroup.id] = { startedAt: fallbackStart.toISOString() };
      }
    }

    await tx.matter.update({
      where: { id: matterId },
      data: {
        lastActivityAt: new Date(),
        groupProgress: buildGroupProgressPayload(groupProgress, {
          existingRaw: matterWithProgress?.groupProgress
        }) as Prisma.InputJsonValue
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
      completedAt:
        payload.completedAt === undefined
          ? step.completedAt?.toISOString() ?? null
          : completedAt?.toISOString() ?? null,
      dueAt: payload.dueAt === undefined ? step.dueAt : dueAt?.toISOString() ?? null
    }
  });
}
