"use client";

import { FormEvent, useState } from "react";
import { ImportMattersModal } from "@/components/import-matters-modal";
import { redirect } from 'next/navigation';
type ClientOption = {
  id: string;
  name: string;
  companyName: string;
};

type TemplateOption = {
  id: string;
  name: string;
};

type Props = {
  clients: ClientOption[];
  templates: TemplateOption[];
  isClientPermission: boolean;
};

export function MatterCreateForm({ clients, templates, isClientPermission }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const creatingNewClient = selectedClientId === "__new__";
  if(isClientPermission && creatingNewClient){
    redirect('/access-denied');
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError(null);

    const formData = new FormData(event.currentTarget);

    const payload = {
      title: String(formData.get("title") ?? ""),
      blurb: String(formData.get("blurb") ?? ""),
      clientId: creatingNewClient ? null : String(formData.get("clientId") ?? ""),
      newClient: creatingNewClient
        ? {
            name: String(formData.get("newClientName") ?? ""),
            companyName: String(formData.get("newClientCompanyName") ?? ""),
            logoUrl: String(formData.get("newClientLogoUrl") ?? "") || null
          }
        : null,
      engagementDate: String(formData.get("engagementDate") ?? ""),
      amountPaid: Number(formData.get("amountPaid") ?? 0),
      dueDate: String(formData.get("dueDate") ?? ""),
      templateId: String(formData.get("templateId") ?? "") || null
    };

    const response = await fetch("/api/matters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setError(data?.error ?? "Unable to create matter.");
      return;
    }

    const data = (await response.json()) as { matterId: string };
    window.location.href = `/matters/${data.matterId}`;
  }

  return (
    <>
      <form onSubmit={onSubmit} className="card grid matter-create-card">
        <input name="title" placeholder="Matter title" required className="input" />
        <textarea
          name="blurb"
          placeholder="Matter summary"
          required
          rows={4}
          className="input"
          style={{ resize: "vertical" }}
        />
        <div className="row">
          <select
            name="clientId"
            required
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            value={selectedClientId}
            onChange={(event) => setSelectedClientId(event.target.value)}
          >
            <option value="">Select client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} - {client.companyName}
              </option>
            ))}
            <option value="__new__">+ Create new client</option>
          </select>
          <select name="templateId" className="input" style={{ flex: 1, minWidth: 200 }}>
            <option value="">No MatterFlow</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        {creatingNewClient ? (
          <div className="grid" style={{ gap: 10 }}>
            <input
              name="newClientName"
              placeholder="New client contact name"
              required
              className="input"
            />
            <input
              name="newClientCompanyName"
              placeholder="New client company name"
              required
              className="input"
            />
            <input
              name="newClientLogoUrl"
              placeholder="Logo URL (optional)"
              className="input"
            />
          </div>
        ) : null}
        <div className="row">
          <label className="meta">
            Engagement Date
            <input name="engagementDate" type="date" required className="input" />
          </label>
          <label className="meta">
            Due Date
            <input name="dueDate" type="date" required className="input" />
          </label>
          <label className="meta">
            Amount Paid
            <input name="amountPaid" type="number" min={0} required className="input" />
          </label>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button type="submit" className="button primary" disabled={status === "saving"}>
            {status === "saving" ? "Creating..." : "Create Matter"}
          </button>
          <button type="button" className="button" onClick={() => setImportOpen(true)}>
            Import CSV
          </button>
        </div>
        {error ? <div className="meta">{error}</div> : null}
      </form>
      <ImportMattersModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
