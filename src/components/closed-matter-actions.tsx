"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  matterId: string;
};

export function ClosedMatterActions({ matterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"reopen" | "delete" | null>(null);

  async function onReopen() {
    setBusy("reopen");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" })
    });

    if (response.ok) {
      router.refresh();
      return;
    }

    setBusy(null);
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this closed matter permanently?");
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
      <button type="button" className="button" onClick={onReopen} disabled={busy !== null}>
        {busy === "reopen" ? "Reopening..." : "Reopen"}
      </button>
      <button type="button" className="button" onClick={onDelete} disabled={busy !== null}>
        {busy === "delete" ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
