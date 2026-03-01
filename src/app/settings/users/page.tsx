import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { InviteUserForm } from "@/components/invite-user-form";
import { requireFirmMembership } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { roleLabel } from "@/lib/roles";

export default async function UsersSettingsPage() {
  const { membership } = await requireFirmMembership();

  if (membership.role !== "ADMIN") {
    redirect("/home");
  }

  const [memberships, invitations] = await Promise.all([
    prisma.firmMembership.findMany({
      where: { firmId: membership.firmId },
      include: { user: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.invitation.findMany({
      where: {
        firmId: membership.firmId,
        acceptedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <main>
      <AppNav active="users" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>Users</h1>
        <div className="row" style={{ gap: 8 }}>
          <Link className="button" href="/rules">
            Flow Controls
          </Link>
          <Link className="button" href="/home">
            Back to Flow Control
          </Link>
        </div>
      </div>

      <div className="card grid" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Invite User</h2>
        <InviteUserForm />
      </div>

      <div className="card grid" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Current Members</h2>
        {memberships.map((entry) => (
          <div key={entry.id} className="list-item">
            <strong>{entry.user.email ?? "No email"}</strong>
            <div className="meta">{roleLabel(entry.role)}</div>
          </div>
        ))}
      </div>

      <div className="card grid">
        <h2 style={{ margin: 0 }}>Pending Invites</h2>
        {invitations.length === 0 ? (
          <div className="meta">No pending invites.</div>
        ) : (
          invitations.map((invite) => (
            <div key={invite.id} className="list-item">
              <strong>{invite.email}</strong>
              <div className="meta">
                {roleLabel(invite.role)} | Expires {invite.expiresAt.toLocaleDateString("en-US")}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
