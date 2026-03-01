import Link from "next/link";
import { redirect } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { RulesSettingsForm } from "@/components/rules-settings-form";
import { requireFirmMembership } from "@/lib/firm-access";
import { getFirmSettings } from "@/lib/firm-settings";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const { membership, user } = await requireFirmMembership();

  if (membership.role !== "ADMIN") {
    redirect("/home");
  }

  const settings = await getFirmSettings(membership.firmId);

  return (
    <main>
      <AppNav active="rules" userName={user?.name ?? user?.email ?? "Admin"} />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>Flow Controls</h1>
        <Link className="button" href="/home">
          Back to Flow Control
        </Link>
      </div>

      <div className="card grid">
        <p className="meta" style={{ margin: 0 }}>
          Configure Flow risk, out-of-flow, aging, and flow-breakdown thresholds for your firm.
        </p>
        <RulesSettingsForm initial={settings} />
      </div>
    </main>
  );
}
