"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  matterId: string;
};
 
export function MatterActions({ matterId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"archive" | "close" | "delete" | null>(null);

  async function onArchive() {
    setBusy("archive");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" })
    });

    if (response.ok) {
      router.push("/home");
      router.refresh();
      return;
    }

    setBusy(null);
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this matter permanently?");
    if (!confirmed) {
      return;
    }

    setBusy("delete");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "DELETE"
    });

    if (response.ok) {
      router.push("/home");
      router.refresh();
      return;
    }

    setBusy(null);
  }

  async function onClose() {
    const confirmed = window.confirm("Close this matter? It will move to Closed Matters.");
    if (!confirmed) {
      return;
    }

    setBusy("close");
    const response = await fetch(`/api/matters/${matterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close" })
    });

    if (response.ok) {
      router.push("/matters/closed");
      router.refresh();
      return;
    }

    setBusy(null);
  }

  return (
    <div className="row matter-control-row">
      <button type="button" className="button btn-secondary-soft" onClick={onClose} disabled={busy !== null}>
        {busy === "close" ? "Closing..." : "Close"}
      </button>
      <button type="button" className="button btn-secondary-soft" onClick={onArchive} disabled={busy !== null}>
        {busy === "archive" ? "Archiving..." : "Archive"}
      </button>
      <button type="button" className="button btn-danger-ghost" onClick={onDelete} disabled={busy !== null}>
        {busy === "delete" ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}
