import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type CreateTemplatePayload = {
  name?: string;
};

export async function GET() {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const templates = await prisma.matterTemplate.findMany({
    where: { firmId: context.membership.firmId },
    include: {
      groups: { orderBy: { sortOrder: "asc" } },
      steps: { orderBy: { sortOrder: "asc" } }
    },
    orderBy: { sortOrder: "asc" }
  });

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const payload = (await request.json()) as CreateTemplatePayload;
  const name = payload.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  }

  const last = await prisma.matterTemplate.findFirst({
    where: { firmId: context.membership.firmId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  const template = await prisma.matterTemplate.create({
    data: {
      firmId: context.membership.firmId,
      name,
      sortOrder: (last?.sortOrder ?? 0) + 1
    },
    include: {
      groups: true,
      steps: true
    }
  });

  return NextResponse.json({ template });
}
