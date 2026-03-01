import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { MatterCreateForm } from "@/components/matter-create-form";
import { requireFirmMembership } from "@/lib/firm-access";
import { prisma } from "@/lib/prisma";
import { getFirmTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function NewMatterPage() {
  const { membership } = await requireFirmMembership();

  const [clients, templates] = await Promise.all([
    prisma.client.findMany({
      where: { firmId: membership.firmId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        companyName: true
      }
    }),
    getFirmTemplates(membership.firmId)
  ]);

  return (
    <main>
      <AppNav active="new" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>New Matter</h1>
        <Link className="button" href="/home">
          Back to Flow Control
        </Link>
      </div>

      <MatterCreateForm
        clients={clients}
        templates={templates.map((template) => ({ id: template.id, name: template.name }))}
      />
    </main>
  );
}
