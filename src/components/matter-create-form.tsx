"use client";

import { FormEvent, useState } from "react";
import { ImportMattersModal } from "@/components/import-matters-modal";
import { redirect } from 'next/navigation';
import { Label } from "./ui/label";
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
        <div className="row">
          <div className="col-12">
          <div className="form-group">
            <Label>Matter Title</Label>
            <input name="title" placeholder="Matter title" required className="input" />
          </div>
        </div>
        </div>
        
        <div className="row">
          <div className="col-12">
          <div className="form-group">
            <Label>Matter Summary</Label>
            <textarea
              name="blurb"
              placeholder="Matter summary"
              required
              rows={4}
              className="input"
              style={{ resize: "vertical" }}
            />
          </div>
        </div>
        </div>
        
        
        <div className="row">
          <div className="col-6">
            <div className="form-group">
              <Label>Client</Label>
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
            </div>
            
          </div>
          <div className="col-6">
            <div className="form-group">
                <Label>FlowGuardian</Label>
                <select name="templateId" className="input" style={{ flex: 1, minWidth: 200 }}>
                  <option value="">No FlowGuardian</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
            </div>
          </div>
          
        </div>
        {creatingNewClient ? (
          <div className="grid" style={{ gap: 10 }}>
            <div className="row">
              <div className="col-4">
                <div className="form-group">
                  <input
                    name="newClientName"
                    placeholder="New client contact name"
                    required
                    className="input"
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <input
                    name="newClientCompanyName"
                    placeholder="New client company name"
                    required
                    className="input"
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <input
                    name="newClientLogoUrl"
                    placeholder="Logo URL (optional)"
                    className="input"
                  />
                </div>
              </div>
            </div>
            
          </div>
        ) : null}
        <div className="row">
          <div className="col-4">
            <div className="form-group">
              <Label className="meta">
                Engagement Date
              </Label>
              <input name="engagementDate" type="date" required className="input" />
            </div>
          </div>
          <div className="col-4">
            <div className="form-group">
              <Label className="meta">
                Due Date
              </Label>
              <input name="dueDate" type="date" required className="input" />
            </div>
          </div>
          <div className="col-4">
            <div className="form-group">
              <Label className="meta">
                Amount Paid
              </Label>
              <input name="amountPaid" type="number" min={0} required className="input" />
            </div>
          </div>
          
        </div>
        <div className="row temp-action-row" style={{ gap: 10 }}>
          <button type="button" className="button temp-btn-import" onClick={() => setImportOpen(true)}>
            Import CSV
          </button>
          <button type="submit" className="button primary temp-btn-save" disabled={status === "saving"}>
            {status === "saving" ? "Creating..." : "Create Matter"}
          </button>
        </div>
        {error ? <div className="meta">{error}</div> : null}
      </form>
      <ImportMattersModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
