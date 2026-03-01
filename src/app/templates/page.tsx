import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { TemplatesManager } from "@/components/templates-manager";
import { requireAdminMembership } from "@/lib/firm-access";
import { getFirmTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const { membership } = await requireAdminMembership();
  const templates = await getFirmTemplates(membership.firmId);

  return (
    <main>
      <AppNav active="templates" />
      <div className="header-row templates-header">
        <div className="templates-title-block">
          <h1 style={{ margin: 0 }}>MatterFlows</h1>
          <p className="templates-subtext">
            Create MatterFlows for your firm&apos;s matter types with defined Flow Stages and Flow Controls.
          </p>
        </div>
        <Link className="button btn-secondary-soft" href="/home">
          Back to Flow Control
        </Link>
      </div>

      <TemplatesManager initialTemplates={templates} />
    </main>
  );
}
