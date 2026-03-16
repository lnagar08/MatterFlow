import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

type iSession = {
  user: {
    id:string;
  }
}

export async function getFirmTemplates(firmId: string) {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }

  return prisma.matterTemplate.findMany({
    where: { userId: session.user.id, firmId },
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
