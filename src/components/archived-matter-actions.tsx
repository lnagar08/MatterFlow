"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  matterId: string;
};

export function ArchivedMatterActions({ matterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);

  async function onRestore() {
    setBusy("restore");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchive" })
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setBusy(null);
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this archived matter permanently?");
    if (!confirmed) {
      return;
    }

    setBusy("delete");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "DELETE"
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setBusy(null);
  }

  return (
    <div className="row">
      <button type="button" className="button" onClick={onRestore} disabled={busy !== null}>
        {busy === "restore" ? "Restoring..." : "Restore"}
      </button>
      <button type="button" className="button" onClick={onDelete} disabled={busy !== null}>
        {busy === "delete" ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
