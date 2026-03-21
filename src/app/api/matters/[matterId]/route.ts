import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/log";

type Params = {
  params: Promise<{ matterId: string }>;
};

type PatchPayload = {
  action?: "archive" | "unarchive" | "close" | "reopen";
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

  const { matterId } = await params;
  const payload = (await request.json()) as PatchPayload;

  const matter = await prisma.matter.findFirst({
    where: {
      id: matterId,
	    userId: userid,
      firmId: context.membership.firmId
    }
  });

  if (!matter) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  if (
    payload.action !== "archive" &&
    payload.action !== "unarchive" &&
    payload.action !== "close" &&
    payload.action !== "reopen"
  ) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const nextArchivedAt =
    payload.action === "archive" ? new Date() : payload.action === "unarchive" ? null : matter.archivedAt;
  const nextClosedAt =
    payload.action === "close" ? new Date() : payload.action === "reopen" ? null : matter.closedAt;

  await prisma.matter.update({
    where: { 
      id: matterId,
      userId: userid,
     },
    data: {
      archivedAt: payload.action === "close" ? null : nextArchivedAt,
      closedAt: payload.action === "archive" ? null : nextClosedAt
    }
  });

  await logActivity(
    userid,
    "UPDATE",
    "matter",
    matterId,
    payload.action
  );

  revalidatePath("/home");
  revalidatePath("/penalty-box");
  revalidatePath("/matters");
  revalidatePath(`/matters/${matterId}`);

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

  const { matterId } = await params;

  const result = await prisma.matter.deleteMany({
    where: {
      id: matterId,
      userId: userid,
      firmId: context.membership.firmId
    }
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  await logActivity(
    userid,
    "DELETE",
    "matter",
    matterId,
    'matter is deleted'
  );

  revalidatePath("/home");
  revalidatePath("/penalty-box");
  revalidatePath("/matters");
  revalidatePath(`/matters/${matterId}`);

  return NextResponse.json({ ok: true });
}
