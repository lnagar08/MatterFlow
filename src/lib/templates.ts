import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}

export async function getFirmTemplates(firmId: string) {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  return prisma.matterTemplate.findMany({
    where: { userId: userid, firmId },
    include: {
      groups: {
        orderBy: {
          sortOrder: "asc"
        }
      },
      steps: {
        orderBy: {
          sortOrder: "asc"
        }
      }
    },
    orderBy: {
      sortOrder: "asc"
    }
  });
}
