import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ templateId: string }> };

type UpdateTemplatePayload = {
  name?: string;
};

export async function PATCH(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { templateId } = await params;
  const payload = (await request.json()) as UpdateTemplatePayload;
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  }

  const template = await prisma.matterTemplate.updateMany({
    where: {
      id: templateId,
      firmId: context.membership.firmId
    },
    data: {
      name
    }
  });

  if (template.count === 0) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
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

  const { templateId } = await params;

  const result = await prisma.matterTemplate.deleteMany({
    where: {
      id: templateId,
      firmId: context.membership.firmId
    }
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
