import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { getHomeData } from "@/lib/home-data";

export async function GET(request: Request) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  const data = await getHomeData({
    firmId: context.membership.firmId,
    query: q
  });

  return NextResponse.json(data);
}
