"use client";

import { FormEvent, useState } from "react";

import { type InviteRole } from "@/lib/roles";

const DEFAULT_ROLE: InviteRole = "ATTORNEY";

type InviteResponse = {
  inviteUrl: string;
};

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>(DEFAULT_ROLE);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setInviteUrl(null);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, role })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setError(payload?.error ?? "Unable to create invitation.");
      return;
    }

    const payload = (await response.json()) as InviteResponse;
    setStatus("success");
    setInviteUrl(payload.inviteUrl);
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 10 }}>
      <div className="row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="associate@firm.com"
          required
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 15,
            flex: 1,
            minWidth: 220
          }}
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as InviteRole)}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 15
          }}
        >
          <option value="ATTORNEY">Attorney</option>
          <option value="STAFF">Staff</option>
          <option value="READ_ONLY">Read Only</option>
        </select>
        <button className="button primary" type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Inviting..." : "Invite User"}
        </button>
      </div>

      {inviteUrl ? (
        <div className="card" style={{ padding: 12 }}>
          <div className="meta">Invite link</div>
          <a href={inviteUrl}>{inviteUrl}</a>
        </div>
      ) : null}

      {error ? <div className="meta">{error}</div> : null}
    </form>
  );
}
