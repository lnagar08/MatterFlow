import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { getTemplateSnapshot, snapshotSignature, syncTemplateToMatters } from "@/lib/template-sync";

type Params = { params: Promise<{ templateId: string }> };

type ReorderPayload = {
  groups?: Array<{ id: string; sortOrder: number }>;
  steps?: Array<{ id: string; sortOrder: number }>;
  groupOrder?: string[];
  stepOrder?: string[];
};

export async function POST(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { templateId } = await params;
  const previousTemplate = await getTemplateSnapshot(templateId);
  const previousSignature = previousTemplate ? snapshotSignature(previousTemplate) : null;
  const template = await prisma.matterTemplate.findFirst({
    where: {
      id: templateId,
      firmId: context.membership.firmId
    }
  });

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const payload = (await request.json()) as ReorderPayload;
  const groups =
    payload.groupOrder && payload.groupOrder.length > 0
      ? payload.groupOrder.map((id, index) => ({ id, sortOrder: index + 1 }))
      : payload.groups ?? [];
  const steps =
    payload.stepOrder && payload.stepOrder.length > 0
      ? payload.stepOrder.map((id, index) => ({ id, sortOrder: index + 1 }))
      : payload.steps ?? [];

  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      await tx.templateGroup.update({
        where: { id: group.id },
        data: { sortOrder: group.sortOrder }
      });
    }

    for (const step of steps) {
      await tx.templateStep.update({
        where: { id: step.id },
        data: { sortOrder: step.sortOrder }
      });
    }
  });

  const updatedTemplate = await prisma.matterTemplate.findFirst({
    where: {
      id: templateId,
      firmId: context.membership.firmId
    },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (previousSignature) {
    await syncTemplateToMatters({
      firmId: context.membership.firmId,
      templateId,
      previousSignature,
      previousSnapshot: previousTemplate
    });
  }

  return NextResponse.json({
    ok: true,
    template: updatedTemplate,
    debug: {
      appliedStepOrder: steps
    }
  });
}
