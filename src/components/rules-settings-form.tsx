"use client";

import { useState } from "react";

type Props = {
  initial: {
    bottleneckNoProgressDays: number;
    noMovementDays: number;
    bottleneckDays?: number;
    defaultGroupExpectedDays: number;
    groupGraceDays: number;
    groupTimingEnabled?: boolean;
    agingDays: number;
    dueSoonHours: number;
    atRiskStageWindowDays?: number;
    penaltyBoxOpenDays: number;
    penaltyIncludeOverdue?: boolean;
    penaltyIncludeAging?: boolean;
  };
};

export function RulesSettingsForm({ initial }: Props) {
  const defaults = {
    bottleneckDays: "7",
    defaultGroupExpectedDays: "7",
    groupGraceDays: "2",
    groupTimingEnabled: true,
    agingDays: "30",
    dueSoonHours: "48",
    atRiskStageWindowDays: "2",
    penaltyBoxOpenDays: "40",
    penaltyIncludeOverdue: true,
    penaltyIncludeAging: true
  };
  const [form, setForm] = useState({
    bottleneckDays: String(initial.bottleneckDays ?? initial.noMovementDays),
    defaultGroupExpectedDays: String(initial.defaultGroupExpectedDays),
    groupGraceDays: String(initial.groupGraceDays),
    groupTimingEnabled: initial.groupTimingEnabled ?? true,
    agingDays: String(initial.agingDays),
    dueSoonHours: String(initial.dueSoonHours),
    atRiskStageWindowDays: String(initial.atRiskStageWindowDays ?? 2),
    penaltyBoxOpenDays: String(initial.penaltyBoxOpenDays),
    penaltyIncludeOverdue: initial.penaltyIncludeOverdue ?? true,
    penaltyIncludeAging: initial.penaltyIncludeAging ?? true
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);

    setSaving(true);
    try {
      const response = await fetch("/api/settings/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bottleneckNoProgressDays: Number(form.groupGraceDays),
          noMovementDays: Number(form.bottleneckDays),
          bottleneckDays: Number(form.bottleneckDays),
          defaultGroupExpectedDays: Number(form.defaultGroupExpectedDays),
          groupGraceDays: Number(form.groupGraceDays),
          groupTimingEnabled: form.groupTimingEnabled,
          agingDays: Number(form.agingDays),
          dueSoonHours: Number(form.dueSoonHours),
          atRiskStageWindowDays: Number(form.atRiskStageWindowDays),
          penaltyBoxOpenDays: Number(form.penaltyBoxOpenDays),
          penaltyIncludeOverdue: form.penaltyIncludeOverdue,
          penaltyIncludeAging: form.penaltyIncludeAging
        })
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to save rules.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Unable to save rules.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid" style={{ gap: 14 }} onSubmit={onSubmit}>
      <div className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>Out of Flow Controls</h2>
        <div className="row">
          <div className="col-6">
            <div className="form-group">
              <label className="meta">Out of Flow if no movement for (days)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={365}
                value={form.bottleneckDays}
                onChange={(event) => setForm((current) => ({ ...current, bottleneckDays: event.target.value }))}
              />
              <span className="meta">Progress is any Flow Step completion/change, due date change, MatterFlow apply, or step edit.</span>
            </div>
            
          </div>

          <div className="col-6">
            <div className="form-group">
                <label className="meta">Flow Stage Expected Duration (days)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={365}
                  value={form.defaultGroupExpectedDays}
                  onChange={(event) => setForm((current) => ({ ...current, defaultGroupExpectedDays: event.target.value }))}
                />
            </div>
          </div>
        </div>
        
        <div className="row">
          <div className="col-12">
             <div className="form-group">
                <label className="meta">Flow Stage grace days (beyond expected duration)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={30}
                  value={form.groupGraceDays}
                  onChange={(event) => setForm((current) => ({ ...current, groupGraceDays: event.target.value }))}
                />
             </div>
             <div className="form-group">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={form.groupTimingEnabled}
                  onChange={(event) => setForm((current) => ({ ...current, groupTimingEnabled: event.target.checked }))}
                />
                <span className="meta">Enable Flow Stage timing for out-of-flow detection</span>
              </label>
              <p className="meta" style={{ margin: 0 }}>
                Out of Flow is triggered when current Flow Stage elapsed days exceed expected + grace.
              </p>
             </div>
          </div>
        </div>  
       
        
      </div>

      <div className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>Flow Risk Window</h2>
        <div className="row">
          <div className="col-6">
            <div className="form-group">
              <label className="meta">Flow Risk Window (hours)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={168}
                value={form.dueSoonHours}
                onChange={(event) => setForm((current) => ({ ...current, dueSoonHours: event.target.value }))}
              />
            </div>
          </div>

          <div className="col-6">
            <div className="form-group">
              <label className="meta">At Flow Risk if stage has this many days left</label>
              <input
                className="input"
                type="number"
                min={0}
                max={30}
                value={form.atRiskStageWindowDays}
                onChange={(event) => setForm((current) => ({ ...current, atRiskStageWindowDays: event.target.value }))}
              />
              <span className="meta">Set to 0 to disable this rule and revert to due-soon only behavior.</span>
            </div>
          </div>
        </div>
          
      </div>

      <div className="grid" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>Flow Lifecycle & Flow Breakdown</h2>
        <div className="row">
          <div className="col-6">
            <div className="form-group">
              <label className="meta">Flow Lifecycle Limit (days)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={3650}
                value={form.agingDays}
                onChange={(event) => setForm((current) => ({ ...current, agingDays: event.target.value }))}
              />
            </div>
          </div>

          <div className="col-6">
            <div className="form-group">
              <label className="meta">Flow Breakdown threshold (days)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={3650}
                value={form.penaltyBoxOpenDays}
                onChange={(event) => setForm((current) => ({ ...current, penaltyBoxOpenDays: event.target.value }))}
              />
            </div>
          </div>

          <div className="col-6">
            <div className="form-group">
              <label className="checkbox-field">
              <input
                className="checkbox-field"
                type="checkbox"
                checked={form.penaltyIncludeOverdue}
                onChange={(event) => setForm((current) => ({ ...current, penaltyIncludeOverdue: event.target.checked }))}
              />
              Include overdue Flow Steps in Flow Breakdown reasons</label>
            </div>
            
          </div>

          <div className="col-6">
            <div className="form-group">
              <label className="checkbox-field">
              <input
                className="checkbox-field"
                type="checkbox"
                checked={form.penaltyIncludeAging}
                onChange={(event) => setForm((current) => ({ ...current, penaltyIncludeAging: event.target.checked }))}
              />
              Include Flow Lifecycle limit in Flow Breakdown reasons</label>
            </div>
            
          </div>
        </div>
        
      </div>

      
        <div className="row temp-action-row" style={{ gap: 8 }}>
          
          <button
            type="button"
            className="button temp-btn-import"
            disabled={saving}
            onClick={() => setForm(defaults)}
          >
            Reset to recommended Flow defaults
          </button>
          <button className="button primary temp-btn-save" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Flow Controls"}
          </button>
        </div>
        {saved ? <span className="meta" style={{ color: "#198754" }}>Saved</span> : null}
     
      {error ? <div className="meta" style={{ color: "#b91c1c" }}>{error}</div> : null}
    </form>
  );
}
