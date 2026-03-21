import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/log";

type Params = { params: Promise<{ templateId: string }> };

type UpdateTemplatePayload = {
  name?: string;
};
type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
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
      userId: userid,
      firmId: context.membership.firmId
    },
    data: {
      name
    }
  });

  await logActivity(
    session.user.id,
    "UPDATE",
    "Template",
    templateId,
    `update template}`
  );

  if (template.count === 0) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
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
      userId: userid,
      firmId: context.membership.firmId
    }
  });

  await logActivity(
    session.user.id,
    "DELETE",
    "Template",
    templateId,
    `Delete template}`
  );

  if (result.count === 0) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
