import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ groupId: string }> };

type Payload = {
  title?: string;
  indentLevel?: number;
  expectedDurationDays?: number | string | null;
};

export async function PATCH(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { groupId } = await params;
  const payload = (await request.json()) as Payload;

  const group = await prisma.templateGroup.findFirst({
    where: {
      id: groupId,
      template: {
        firmId: context.membership.firmId
      }
    }
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const title = payload.title?.trim() || group.title;
  const indentLevel = Math.max(0, Math.min(5, Number(payload.indentLevel ?? group.indentLevel)));
  const rawExpectedDuration =
    payload.expectedDurationDays === null || payload.expectedDurationDays === undefined || payload.expectedDurationDays === ""
      ? group.expectedDurationDays
      : Math.max(1, Math.min(365, Number(payload.expectedDurationDays)));
  const expectedDurationDays =
    rawExpectedDuration === null || Number.isNaN(rawExpectedDuration) ? null : rawExpectedDuration;

  await prisma.templateGroup.update({
    where: { id: groupId },
    data: {
      title,
      indentLevel,
      expectedDurationDays
    }
  });

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

  const { groupId } = await params;

  const group = await prisma.templateGroup.findFirst({
    where: {
      id: groupId,
      template: {
        firmId: context.membership.firmId
      }
    }
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  await prisma.templateStep.updateMany({
    where: { groupId },
    data: { groupId: null }
  });

  await prisma.templateGroup.delete({
    where: { id: groupId }
  });

  return NextResponse.json({ ok: true });
}
