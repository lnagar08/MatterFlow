
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        firm: true,
        // Assuming your schema allows this relation:
        // If not explicitly defined in Prisma, we'll fetch the name manually
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // If you need to manually attach Attorney names because of missing relations:
    const clientsWithAttorneys = await Promise.all(clients.map(async (client) => {
      if (!client.userId) return { ...client, attorneyName: "Unassigned" };
      const attorney = await prisma.user.findUnique({
        where: { id: client.userId },
        select: { name: true }
      });
      return { ...client, attorneyName: attorney?.name || "Unknown" };
    }));

    return NextResponse.json(clientsWithAttorneys);
  } catch (error) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }
}
