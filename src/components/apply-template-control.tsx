"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { redirect } from 'next/navigation';
type TemplateOption = {
  id: string;
  name: string;
};

type Props = {
  matterId: string;
  templates: TemplateOption[];
  isEditMetterPermission: boolean;
};

export function ApplyTemplateControl({ matterId, templates, isEditMetterPermission }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  
  async function onApply() {
    if (!templateId || busy) {
      return;
    }
    if(isEditMetterPermission){
      redirect('/access-denied');
    }
    const confirmed = window.confirm(
      "Apply this MatterFlow and replace the current checklist for this matter?"
    );
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/matters/${matterId}/apply-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Unable to apply MatterFlow.");
        return;
      }

      setSuccess("MatterFlow applied");
      router.refresh();
    } catch {
      setError("Unable to apply MatterFlow.");
    } finally {
      setBusy(false);
    }
  }

  if (templates.length === 0) {
    return <div className="meta">No MatterFlows available to apply.</div>;
  }

  return (
    <div className="row matter-control-row">
      <select
        className="input matter-template-select"
        value={templateId}
        onChange={(event) => setTemplateId(event.target.value)}
      >
        {templates.map((template) => (
          <option value={template.id} key={template.id}>
            {template.name}
          </option>
        ))}
      </select>

      <button type="button" className="button btn-primary-soft" disabled={busy} onClick={onApply}>
        {busy ? "Applying..." : "Apply MatterFlow"}
      </button>

      {error ? <span className="meta matter-control-error">{error}</span> : null}
      {success ? <span className="meta" style={{ color: "#198754" }}>{success}</span> : null}
    </div>
  );
}
