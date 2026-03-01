import { redirect } from "next/navigation";

import { requireFirmMembership } from "@/lib/firm-access";

export const dynamic = "force-dynamic";

export default async function RulesSettingsPage() {
  const { membership } = await requireFirmMembership();

  if (membership.role !== "ADMIN") {
    redirect("/home");
  }

  redirect("/rules");
}
