import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { getTemplateSnapshot, snapshotSignature, syncTemplateToMatters } from "@/lib/template-sync";

type Params = { params: Promise<{ stepId: string }> };

type Payload = {
  label?: string;
  groupId?: string | null;
  indentLevel?: number;
  defaultDueDaysOffset?: number | null;
};

export async function PATCH(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { stepId } = await params;
  const step = await prisma.templateStep.findFirst({
    where: {
      id: stepId,
      template: {
        firmId: context.membership.firmId
      }
    }
  });

  if (!step) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }
  const previousTemplate = await getTemplateSnapshot(step.templateId);
  const previousSignature = previousTemplate ? snapshotSignature(previousTemplate) : null;

  const payload = (await request.json()) as Payload;

  const label = payload.label?.trim() || step.label;
  const indentLevel = Math.max(0, Math.min(5, Number(payload.indentLevel ?? step.indentLevel)));

  const dueOffsetRaw = payload.defaultDueDaysOffset;
  const defaultDueDaysOffset =
    dueOffsetRaw === null || dueOffsetRaw === undefined ? null : Number(dueOffsetRaw);

  if (defaultDueDaysOffset !== null && Number.isNaN(defaultDueDaysOffset)) {
    return NextResponse.json({ error: "Invalid due day offset." }, { status: 400 });
  }

  let groupId = payload.groupId ?? step.groupId;
  if (groupId) {
    const group = await prisma.templateGroup.findFirst({
      where: {
        id: groupId,
        templateId: step.templateId
      }
    });
    if (!group) {
      groupId = null;
    }
  }

  await prisma.templateStep.update({
    where: { id: stepId },
    data: {
      label,
      groupId,
      indentLevel,
      defaultDueDaysOffset
    }
  });

  if (previousSignature) {
    await syncTemplateToMatters({
      firmId: context.membership.firmId,
      templateId: step.templateId,
      previousSignature,
      previousSnapshot: previousTemplate
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { stepId } = await params;
  const step = await prisma.templateStep.findFirst({
    where: {
      id: stepId,
      template: {
        firmId: context.membership.firmId
      }
    }
  });

  if (!step) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }
  const previousTemplate = await getTemplateSnapshot(step.templateId);
  const previousSignature = previousTemplate ? snapshotSignature(previousTemplate) : null;

  const result = await prisma.templateStep.deleteMany({
    where: {
      id: stepId,
      template: {
        firmId: context.membership.firmId
      }
    }
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Step not found." }, { status: 404 });
  }

  if (previousSignature) {
    await syncTemplateToMatters({
      firmId: context.membership.firmId,
      templateId: step.templateId,
      previousSignature,
      previousSnapshot: previousTemplate
    });
  }

  return NextResponse.json({ ok: true });
}
