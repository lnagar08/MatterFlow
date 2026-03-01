import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { ClosedMatterActions } from "@/components/closed-matter-actions";
import { requireFirmMembership } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClosedMattersPage() {
  const { membership } = await requireFirmMembership();

  const matters = await prisma.matter.findMany({
    where: {
      firmId: membership.firmId,
      closedAt: {
        not: null
      }
    },
    include: {
      client: true
    },
    orderBy: {
      closedAt: "desc"
    }
  });

  return (
    <main>
      <AppNav active="closed" />

      <div className="header-row">
        <h1 style={{ margin: 0 }}>Closed Matters</h1>
        <Link className="button" href="/home">
          Back to Home
        </Link>
      </div>

      <div className="matter-list">
        {matters.length === 0 ? (
          <div className="card">
            <div className="meta">No closed matters.</div>
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
                  Closed {matter.closedAt ? new Date(matter.closedAt).toLocaleDateString("en-US") : ""}
                </div>
              </div>

              <ClosedMatterActions matterId={matter.id} />
            </div>
          ))
        )}
      </div>
    </main>
  );
}
