import Link from "next/link";
import { redirect } from "next/navigation";

import { MagicLinkForm } from "@/components/magic-link-form";
import { getCurrentUserContext } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { firm: true }
  });

  if (!invitation) {
    return (
      <main>
        <div className="card">This invitation link is invalid.</div>
      </main>
    );
  }

  if (invitation.expiresAt <= new Date()) {
    return (
      <main>
        <div className="card">This invitation has expired.</div>
      </main>
    );
  }

  const context = await getCurrentUserContext();

  if (!context) {
    return (
      <main>
        <div className="card grid">
          <h1 style={{ margin: 0 }}>Join {invitation.firm.name}</h1>
          <div className="meta">
            Invitation for {invitation.email} as {roleLabel(invitation.role)}
          </div>
          <MagicLinkForm
            callbackUrl={`/invite/${token}`}
            initialEmail={invitation.email}
            title="Sign in with the invited email"
          />
          <Link className="button" href="/">
            Back Home
          </Link>
        </div>
      </main>
    );
  }

  const email = context.user.email?.toLowerCase();
  if (!email || email !== invitation.email.toLowerCase()) {
    return (
      <main>
        <div className="card grid">
          <h1 style={{ margin: 0 }}>Wrong account</h1>
          <div className="meta">
            This invite is for {invitation.email}. You are signed in as {context.user.email ?? "unknown"}.
          </div>
        </div>
      </main>
    );
  }

  const existingMembership = context.membership;
  if (existingMembership && existingMembership.firmId !== invitation.firmId) {
    return (
      <main>
        <div className="card grid">
          <h1 style={{ margin: 0 }}>Invite cannot be accepted</h1>
          <div className="meta">Your account already belongs to another firm.</div>
        </div>
      </main>
    );
  }

  if (!existingMembership) {
    await prisma.firmMembership.create({
      data: {
        userId: context.user.id,
        firmId: invitation.firmId,
        role: invitation.role
      }
    });
  } else {
    await prisma.firmMembership.update({
      where: { userId: context.user.id },
      data: { role: invitation.role }
    });
  }

  if (!invitation.acceptedAt) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    });
  }

  redirect("/home");
}
