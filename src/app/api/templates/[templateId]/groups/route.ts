import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ templateId: string }> };

type Payload = {
  title?: string;
  indentLevel?: number;
  expectedDurationDays?: number | string | null;
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
  const title = payload.title?.trim() || "New Group";
  const indentLevel = Math.max(0, Math.min(5, Number(payload.indentLevel ?? 0)));
  const rawExpectedDuration =
    payload.expectedDurationDays === null || payload.expectedDurationDays === undefined || payload.expectedDurationDays === ""
      ? null
      : Math.max(1, Math.min(365, Number(payload.expectedDurationDays)));
  const expectedDurationDays =
    rawExpectedDuration === null || Number.isNaN(rawExpectedDuration) ? null : rawExpectedDuration;

  const last = await prisma.templateGroup.findFirst({
    where: { templateId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  const group = await prisma.templateGroup.create({
    data: {
      templateId,
      title,
      indentLevel,
      expectedDurationDays,
      sortOrder: (last?.sortOrder ?? 0) + 1
    }
  });

  return NextResponse.json({ group });
}
