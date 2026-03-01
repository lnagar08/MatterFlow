import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ templateId: string }> };

type ReorderPayload = {
  groups?: Array<{ id: string; sortOrder: number }>;
  steps?: Array<{ id: string; sortOrder: number }>;
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

  const payload = (await request.json()) as ReorderPayload;
  const groups = payload.groups ?? [];
  const steps = payload.steps ?? [];

  await prisma.$transaction(async (tx) => {
    for (const group of groups) {
      await tx.templateGroup.updateMany({
        where: {
          id: group.id,
          templateId
        },
        data: {
          sortOrder: group.sortOrder
        }
      });
    }

    for (const step of steps) {
      await tx.templateStep.updateMany({
        where: {
          id: step.id,
          templateId
        },
        data: {
          sortOrder: step.sortOrder
        }
      });
    }
  });

  return NextResponse.json({ ok: true });
}
