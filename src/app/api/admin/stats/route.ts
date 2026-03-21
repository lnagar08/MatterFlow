// app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Run counts in parallel for better performance
    const [totalClients, totalAttorneys] = await Promise.all([
      prisma.client.count(),
      prisma.user.count({
        where: { role: 'ATTORNEY' }
      })
    ]);

    return NextResponse.json({
      totalClients,
      totalAttorneys,
      // You can add more stats here later (e.g., new users today)
      activeNow: Math.floor(Math.random() * 10) + 1 // Mock data for now
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}