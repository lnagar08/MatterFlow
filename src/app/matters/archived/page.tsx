import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { ArchivedMatterActions } from "@/components/archived-matter-actions";
import { requireFirmMembership } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ArchivedMattersPage() {
  const { membership } = await requireFirmMembership();

  const matters = await prisma.matter.findMany({
    where: {
      firmId: membership.firmId,
      closedAt: null,
      archivedAt: {
        not: null
      }
    },
    include: {
      client: true
    },
    orderBy: {
      archivedAt: "desc"
    }
  });

  return (
    <main>
      <AppNav active="archived" />

      <div className="header-row">
        <h1 style={{ margin: 0 }}>Archived Matters</h1>
        <Link className="button" href="/home">
          Back to Home
        </Link>
      </div>

      <div className="matter-list">
        {matters.length === 0 ? (
          <div className="card">
            <div className="meta">No archived matters.</div>
          </div>
        ) : (
          matters.map((matter) => (
            <div key={matter.id} className="list-item grid">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <strong>{matter.title}</strong>
                  <div className="meta">{matter.client.name}</div>
                </div>
                <div className="meta">
                  Archived {matter.archivedAt ? new Date(matter.archivedAt).toLocaleDateString("en-US") : ""}
                </div>
              </div>

              <ArchivedMatterActions matterId={matter.id} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
