import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { getTemplateSnapshot, snapshotSignature, syncTemplateToMatters } from "@/lib/template-sync";

type Params = { params: Promise<{ templateId: string }> };

type Payload = {
  label?: string;
  groupId?: string | null;
  indentLevel?: number;
  defaultDueDaysOffset?: number | null;
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

  const payload = (await request.json()) as Payload;
  const label = payload.label?.trim() || "New Step";
  const indentLevel = Math.max(0, Math.min(5, Number(payload.indentLevel ?? 0)));

  const normalizedDue =
    payload.defaultDueDaysOffset === null || payload.defaultDueDaysOffset === undefined
      ? null
      : Number(payload.defaultDueDaysOffset);

  if (normalizedDue !== null && Number.isNaN(normalizedDue)) {
    return NextResponse.json({ error: "Invalid due day offset." }, { status: 400 });
  }

  let groupId: string | null = payload.groupId ?? null;
  if (groupId) {
    const group = await prisma.templateGroup.findFirst({
      where: {
        id: groupId,
        templateId
      }
    });

    if (!group) {
      groupId = null;
    }
  }

  const last = await prisma.templateStep.findFirst({
    where: { templateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  const step = await prisma.templateStep.create({
    data: {
      templateId,
      groupId,
      label,
      indentLevel,
      defaultDueDaysOffset: normalizedDue,
      sortOrder: (last?.sortOrder ?? 0) + 1
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

  return NextResponse.json({ step });
}
