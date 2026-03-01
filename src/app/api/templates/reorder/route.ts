import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

type ReorderPayload = {
  templates?: Array<{ id: string; sortOrder: number }>;
};

export async function POST(request: Request) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const payload = (await request.json()) as ReorderPayload;
  const templates = payload.templates ?? [];

  await prisma.$transaction(async (tx) => {
    for (const template of templates) {
      await tx.matterTemplate.updateMany({
        where: {
          id: template.id,
          firmId: context.membership.firmId
        },
        data: {
          sortOrder: template.sortOrder
        }
      });
    }
  });

  return NextResponse.json({ ok: true });
}
