import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { isInviteRole } from "@/lib/roles";

type InvitePayload = {
  email?: string;
  role?: string;
};

export async function POST(request: Request) {
  const context = await getCurrentUserContext();
  const membership = context?.membership;

  if (!membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can invite users." }, { status: 403 });
  }

  const payload = (await request.json()) as InvitePayload;
  const email = payload.email?.trim().toLowerCase();
  const role = payload.role?.trim().toUpperCase() ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  if (!isInviteRole(role)) {
    return NextResponse.json({ error: "Role must be attorney, staff, or read_only." }, { status: 400 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      firmId: membership.firmId,
      role,
      token,
      expiresAt
    }
  });

  const inviteUrl = new URL(`/invite/${invitation.token}`, request.url).toString();
  return NextResponse.json({ inviteUrl });
}
