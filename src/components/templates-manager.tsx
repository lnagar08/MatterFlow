"use client";

import { useMemo, useState } from "react";

type TemplateGroup = {
  id: string;
  title: string;
  indentLevel: number;
  sortOrder: number;
  expectedDurationDays: number | null;
};

type TemplateStep = {
  id: string;
  label: string;
  groupId: string | null;
  indentLevel: number;
  sortOrder: number;
  defaultDueDaysOffset: number | null;
};

type Template = {
  id: string;
  name: string;
  sortOrder: number;
  groups: TemplateGroup[];
  steps: TemplateStep[];
};

type Props = {
  initialTemplates: Template[];
};

type TemplateTab = "workflow" | "custom-fields" | "status-rules" | "billing-default";

function bySortOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function storageKey(templateId: string, key: "status-rules" | "billing-default") {
  return `matterflow.templates.${key}.${templateId}`;
}

export function TemplatesManager({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [busy, setBusy] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<TemplateTab>("workflow");
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialTemplates.map((template) => [template.id, template.groups.map((group) => group.id)]))
  );
  const [statusRules, setStatusRules] = useState<Record<string, { bottleneckDays: string; atRiskDays: string; overdueDays: string }>>({});
  const [billingDefaults, setBillingDefaults] = useState<Record<string, { flatFee: string; revenueRule: string }>>({});

  const sortedTemplates = useMemo(() => bySortOrder(templates), [templates]);

  async function refreshTemplates() {
    const response = await fetch("/api/templates", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { templates: Template[] };
    const nextTemplates = data.templates.map((template) => ({
      ...template,
      groups: bySortOrder(template.groups),
      steps: bySortOrder(template.steps)
    }));
    setTemplates(nextTemplates);
    setOpenGroupIds((prev) => {
      const next = { ...prev };
      for (const template of nextTemplates) {
        if (!next[template.id]) {
          next[template.id] = template.groups.map((group) => group.id);
        }
      }
      return next;
    });
  }

  async function createTemplate(name = "New MatterFlow") {
    setBusy("create-template");
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    await refreshTemplates();
    if (response.ok) {
      const data = (await response.json()) as { template: Template };
      setOpenTemplateId(data.template.id);
    }
    setBusy(null);
  }

  async function duplicateTemplate(template: Template) {
    setBusy(`duplicate-${template.id}`);

    const create = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${template.name} Copy` })
    });

    if (!create.ok) {
      setBusy(null);
      return;
    }

    const created = (await create.json()) as { template: Template };
    const nextTemplateId = created.template.id;

    const groupMap = new Map<string, string>();
    for (const group of bySortOrder(template.groups)) {
      const groupResponse = await fetch(`/api/templates/${nextTemplateId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: group.title, indentLevel: group.indentLevel })
      });
      if (!groupResponse.ok) continue;
      const groupData = (await groupResponse.json()) as { group: TemplateGroup };
      groupMap.set(group.id, groupData.group.id);
    }

    for (const step of bySortOrder(template.steps)) {
      await fetch(`/api/templates/${nextTemplateId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: step.label,
          groupId: step.groupId ? groupMap.get(step.groupId) ?? null : null,
          indentLevel: step.indentLevel,
          defaultDueDaysOffset: step.defaultDueDaysOffset
        })
      });
    }

    await refreshTemplates();
    setOpenTemplateId(nextTemplateId);
    setBusy(null);
  }

  async function updateTemplateName(templateId: string, name: string) {
    setBusy(`template-${templateId}`);
    await fetch(`/api/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function deleteTemplate(templateId: string) {
    setBusy(`delete-template-${templateId}`);
    await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    await refreshTemplates();
    setBusy(null);
  }

  async function addGroup(templateId: string) {
    setBusy(`add-group-${templateId}`);
    await fetch(`/api/templates/${templateId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Flow Stage", indentLevel: 0, expectedDurationDays: null })
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function addStep(templateId: string) {
    setBusy(`add-step-${templateId}`);
    await fetch(`/api/templates/${templateId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New Step", groupId: null, indentLevel: 0 })
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function addStepToGroup(templateId: string, groupId: string) {
    setBusy(`add-step-${templateId}-${groupId}`);
    await fetch(`/api/templates/${templateId}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "New Step", groupId, indentLevel: 0 })
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function updateGroup(
    groupId: string,
    payload: { title: string; indentLevel: number; expectedDurationDays: number | null }
  ) {
    setBusy(`group-${groupId}`);
    await fetch(`/api/templates/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function deleteGroup(groupId: string) {
    setBusy(`delete-group-${groupId}`);
    await fetch(`/api/templates/groups/${groupId}`, { method: "DELETE" });
    await refreshTemplates();
    setBusy(null);
  }

  async function updateStep(
    stepId: string,
    payload: {
      label: string;
      groupId: string | null;
      indentLevel: number;
      defaultDueDaysOffset: number | null;
    }
  ) {
    setBusy(`step-${stepId}`);
    await fetch(`/api/templates/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refreshTemplates();
    setBusy(null);
  }

  async function deleteStep(stepId: string) {
    setBusy(`delete-step-${stepId}`);
    await fetch(`/api/templates/steps/${stepId}`, { method: "DELETE" });
    await refreshTemplates();
    setBusy(null);
  }

  async function persistReorder(templateId: string, groups: TemplateGroup[], steps: TemplateStep[]) {
    await fetch(`/api/templates/${templateId}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: groups.map((group, index) => ({ id: group.id, sortOrder: index + 1 })),
        steps: steps.map((step, index) => ({ id: step.id, sortOrder: index + 1 }))
      })
    });
    await refreshTemplates();
  }

  async function persistTemplateReorder(nextTemplates: Template[]) {
    await fetch("/api/templates/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: nextTemplates.map((template, index) => ({ id: template.id, sortOrder: index + 1 })) })
    });
    await refreshTemplates();
  }

  function onTemplateDrop(sourceId: string, targetId: string) {
    const sorted = bySortOrder(templates);
    const from = sorted.findIndex((template) => template.id === sourceId);
    const to = sorted.findIndex((template) => template.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setTemplates(next);
    void persistTemplateReorder(next);
  }

  function onGroupDrop(template: Template, sourceId: string, targetId: string) {
    const sorted = bySortOrder(template.groups);
    const from = sorted.findIndex((group) => group.id === sourceId);
    const to = sorted.findIndex((group) => group.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, groups: next } : item)));
    void persistReorder(template.id, next, template.steps);
  }

  function onStepDrop(template: Template, sourceId: string, targetId: string) {
    const sorted = bySortOrder(template.steps);
    const from = sorted.findIndex((step) => step.id === sourceId);
    const to = sorted.findIndex((step) => step.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setTemplates((prev) => prev.map((item) => (item.id === template.id ? { ...item, steps: next } : item)));
    void persistReorder(template.id, template.groups, next);
  }

  function toggleGroup(templateId: string, groupId: string) {
    setOpenGroupIds((prev) => {
      const current = prev[templateId] ?? [];
      const next = current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId];
      return { ...prev, [templateId]: next };
    });
  }

  function loadStatusRule(templateId: string) {
    if (statusRules[templateId]) return statusRules[templateId];
    try {
      const raw = window.localStorage.getItem(storageKey(templateId, "status-rules"));
      if (!raw) return { bottleneckDays: "14", atRiskDays: "3", overdueDays: "1" };
      const parsed = JSON.parse(raw) as { bottleneckDays: string; atRiskDays: string; overdueDays: string };
      return parsed;
    } catch {
      return { bottleneckDays: "14", atRiskDays: "3", overdueDays: "1" };
    }
  }

  function loadBillingDefault(templateId: string) {
    if (billingDefaults[templateId]) return billingDefaults[templateId];
    try {
      const raw = window.localStorage.getItem(storageKey(templateId, "billing-default"));
      if (!raw) return { flatFee: "", revenueRule: "Deferred until close" };
      const parsed = JSON.parse(raw) as { flatFee: string; revenueRule: string };
      return parsed;
    } catch {
      return { flatFee: "", revenueRule: "Deferred until close" };
    }
  }

  function updateStatusRule(templateId: string, key: "bottleneckDays" | "atRiskDays" | "overdueDays", value: string) {
    setStatusRules((prev) => {
      const next = { ...(prev[templateId] ?? loadStatusRule(templateId)), [key]: value };
      try {
        window.localStorage.setItem(storageKey(templateId, "status-rules"), JSON.stringify(next));
      } catch {
        // ignore
      }
      return { ...prev, [templateId]: next };
    });
  }

  function updateBillingDefault(templateId: string, key: "flatFee" | "revenueRule", value: string) {
    setBillingDefaults((prev) => {
      const next = { ...(prev[templateId] ?? loadBillingDefault(templateId)), [key]: value };
      try {
        window.localStorage.setItem(storageKey(templateId, "billing-default"), JSON.stringify(next));
      } catch {
        // ignore
      }
      return { ...prev, [templateId]: next };
    });
  }

  return (
    <div className="grid templates-workbench">
      <div className="templates-tabs-row card">
        <div className="templates-view-tabs" role="tablist" aria-label="MatterFlow views">
          <button
            type="button"
            className={`templates-view-tab ${activeTab === "workflow" ? "active" : ""}`}
            onClick={() => setActiveTab("workflow")}
          >
            Flow Stages
          </button>
          <button
            type="button"
            className={`templates-view-tab ${activeTab === "custom-fields" ? "active" : ""}`}
            onClick={() => setActiveTab("custom-fields")}
          >
            Custom Fields
          </button>
          <button
            type="button"
            className={`templates-view-tab ${activeTab === "status-rules" ? "active" : ""}`}
            onClick={() => setActiveTab("status-rules")}
          >
            Flow Controls
          </button>
          <button
            type="button"
            className={`templates-view-tab ${activeTab === "billing-default" ? "active" : ""}`}
            onClick={() => setActiveTab("billing-default")}
          >
            Billing Default
          </button>
        </div>

        <div className="templates-sort-side">
          <span className="home-sort-label">Sort</span>
          <button type="button" className="button nav-pill" onClick={() => setReorderMode((value) => !value)}>
            Reorder Mode: {reorderMode ? "On" : "Off"}
          </button>
        </div>
      </div>

      {activeTab === "workflow" ? (
        <div className="templates-stack">
          {sortedTemplates.map((template) => {
            const groups = bySortOrder(template.groups);
            const steps = bySortOrder(template.steps);
            const isOpen = openTemplateId === template.id;
            const stepCount = steps.length;
            const billing = loadBillingDefault(template.id);

            return (
              <section
                key={template.id}
                className={`template-card template-blueprint-card ${isOpen ? "open" : ""}`}
                draggable={reorderMode}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", `template:${template.id}`)}
                onDragOver={(event) => {
                  if (!reorderMode) return;
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!reorderMode) return;
                  event.preventDefault();
                  const data = event.dataTransfer.getData("text/plain");
                  if (!data.startsWith("template:")) return;
                  onTemplateDrop(data.replace("template:", ""), template.id);
                }}
              >
                <div className="template-blueprint-top">
                  <div className="template-blueprint-title-wrap">
                    <button
                      type="button"
                      className="template-header-btn template-title-btn"
                      onClick={() => setOpenTemplateId((current) => (current === template.id ? null : template.id))}
                    >
                      {template.name}
                    </button>
                    <span className="meta">{stepCount} Flow Steps</span>
                    <span className="meta">{billing.flatFee ? `Default flat fee $${billing.flatFee}` : "Default flat fee —"}</span>
                  </div>

                  <div className="row template-card-actions">
                    {reorderMode ? <span className="template-drag-handle" aria-label="Drag MatterFlow">⋮⋮</span> : null}
                    <button
                      type="button"
                      className="button btn-secondary-soft"
                      onClick={() => setOpenTemplateId((current) => (current === template.id ? null : template.id))}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="button btn-secondary-soft"
                      disabled={busy === `duplicate-${template.id}`}
                      onClick={() => duplicateTemplate(template)}
                    >
                    {busy === `duplicate-${template.id}` ? "Duplicating..." : "Duplicate MatterFlow"}
                    </button>
                    <button
                      type="button"
                      className="button btn-danger-ghost"
                      title="Delete MatterFlow"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="template-section template-blueprint-body">
                    <div className="row template-actions-inline">
                      <input
                        className="input"
                        defaultValue={template.name}
                        onBlur={(event) => updateTemplateName(template.id, event.target.value)}
                        style={{ flex: 1, minWidth: 220 }}
                      />
                      <button className="button ghost" onClick={() => addGroup(template.id)}>
                        Add Flow Stage
                      </button>
                      <button className="button ghost" onClick={() => addStep(template.id)}>
                        Add Flow Step
                      </button>
                    </div>

                    <div className="grid" style={{ gap: 10 }}>
                      {groups.map((group) => {
                        const groupSteps = steps.filter((step) => step.groupId === group.id);
                        const isOpenGroup = (openGroupIds[template.id] ?? []).includes(group.id);
                        return (
                          <div
                            key={group.id}
                            className="template-group-card"
                            draggable={reorderMode}
                            onDragStart={(event) => event.dataTransfer.setData("text/plain", `group:${group.id}`)}
                            onDragOver={(event) => {
                              if (!reorderMode) return;
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              if (!reorderMode) return;
                              event.preventDefault();
                              const data = event.dataTransfer.getData("text/plain");
                              if (!data.startsWith("group:")) return;
                              onGroupDrop(template, data.replace("group:", ""), group.id);
                            }}
                          >
                            <button type="button" className="template-group-header" onClick={() => toggleGroup(template.id, group.id)}>
                              <span>{group.title}</span>
                              <span className="meta">{`Expected: ${group.expectedDurationDays ?? "—"}d`}</span>
                              <span className="meta">{groupSteps.length} Flow Steps</span>
                              <span className={`chevron ${isOpenGroup ? "open" : ""}`}>▸</span>
                            </button>

                            {isOpenGroup ? (
                              <div className="template-group-body">
                                <div className="row">
                                  <input
                                    className="input"
                                    defaultValue={group.title}
                                    onBlur={(event) =>
                                      updateGroup(group.id, {
                                        title: event.target.value,
                                        indentLevel: group.indentLevel,
                                        expectedDurationDays: group.expectedDurationDays
                                      })
                                    }
                                    style={{ flex: 1, minWidth: 180, marginLeft: `${group.indentLevel * 20}px` }}
                                    aria-label="Flow Stage name"
                                  />
                                  <label className="grid" style={{ gap: 4 }}>
                                    <span className="meta">Flow Stage expected duration (days)</span>
                                    <input
                                      className="input"
                                      type="number"
                                      min={1}
                                      max={365}
                                      placeholder="e.g. 7"
                                      defaultValue={group.expectedDurationDays ?? ""}
                                      onBlur={(event) =>
                                        updateGroup(group.id, {
                                          title: group.title,
                                          indentLevel: group.indentLevel,
                                          expectedDurationDays:
                                            event.target.value.trim() === "" ? null : Number(event.target.value)
                                        })
                                      }
                                      style={{ width: 170 }}
                                      title="Used to detect out-of-flow status when steps do not have due dates."
                                    />
                                    <span className="meta">Used for out-of-flow detection.</span>
                                  </label>
                                  <button className="icon-danger" onClick={() => deleteGroup(group.id)} title="Delete Flow Stage">
                                    ×
                                  </button>
                                </div>

                                <div className="grid" style={{ gap: 8 }}>
                                  <p className="meta" style={{ margin: 0 }}>
                                    Default due (+days) sets the suggested due date after the prior Flow Step is completed.
                                  </p>
                                  {groupSteps.map((step, index) => (
                                    <div
                                      key={step.id}
                                      className="list-item template-step-row"
                                      draggable={reorderMode}
                                      onDragStart={(event) => event.dataTransfer.setData("text/plain", `step:${step.id}`)}
                                      onDragOver={(event) => {
                                        if (!reorderMode) return;
                                        event.preventDefault();
                                      }}
                                      onDrop={(event) => {
                                        if (!reorderMode) return;
                                        event.preventDefault();
                                        const data = event.dataTransfer.getData("text/plain");
                                        if (!data.startsWith("step:")) return;
                                        onStepDrop(template, data.replace("step:", ""), step.id);
                                      }}
                                    >
                                      <div className="row template-step-clean-row">
                                        <span className="pill">{`#${index + 1}`}</span>
                                        <input
                                          className="input"
                                          defaultValue={step.label}
                                          onBlur={(event) =>
                                            updateStep(step.id, {
                                              label: event.target.value,
                                              groupId: step.groupId,
                                              indentLevel: step.indentLevel,
                                              defaultDueDaysOffset: step.defaultDueDaysOffset
                                            })
                                          }
                                          style={{ flex: 1, minWidth: 220, marginLeft: `${step.indentLevel * 20}px` }}
                                          aria-label="Flow Step title"
                                        />
                                        <label className="grid" style={{ gap: 2 }}>
                                          <span className="meta">Default due (+days)</span>
                                          <input
                                            className="input"
                                            type="number"
                                            placeholder="0"
                                            defaultValue={step.defaultDueDaysOffset ?? ""}
                                            onBlur={(event) =>
                                              updateStep(step.id, {
                                                label: step.label,
                                                groupId: step.groupId,
                                                indentLevel: step.indentLevel,
                                                defaultDueDaysOffset: event.target.value.trim() === "" ? null : Number(event.target.value)
                                              })
                                            }
                                            style={{ width: 150 }}
                                          />
                                        </label>
                                        <span className="meta">Depends on: Prior Flow Step</span>
                                        <button className="icon-danger" onClick={() => deleteStep(step.id)} title="Delete Flow Step">
                                          ×
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    className="button ghost"
                                    disabled={busy === `add-step-${template.id}-${group.id}`}
                                    onClick={() => addStepToGroup(template.id, group.id)}
                                    style={{ justifySelf: "start" }}
                                  >
                                    {busy === `add-step-${template.id}-${group.id}` ? "Adding..." : "+ Add Flow Step"}
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}

          <button className="button primary templates-add-btn" onClick={() => createTemplate()} disabled={busy === "create-template"}>
            {busy === "create-template" ? "Adding..." : "+ Add New MatterFlow"}
          </button>
        </div>
      ) : null}

      {activeTab === "custom-fields" ? (
        <div className="template-card template-panel-placeholder">
          <h3 style={{ margin: 0 }}>MatterFlow Custom Fields</h3>
          <p className="meta" style={{ margin: 0 }}>
            Define extra fields for each MatterFlow type. This panel is ready for firm-specific field definitions.
          </p>
        </div>
      ) : null}

      {activeTab === "status-rules" ? (
        <div className="grid" style={{ gap: 12 }}>
          {sortedTemplates.map((template) => {
            const rule = statusRules[template.id] ?? loadStatusRule(template.id);
            return (
              <div key={template.id} className="template-card template-panel-placeholder">
                <h3 style={{ margin: 0 }}>{template.name}</h3>
                <div className="row">
                  <label className="meta">
                    Out of Flow Rule (days in Flow Step)
                    <input
                      className="input"
                      type="number"
                      value={rule.bottleneckDays}
                      onChange={(event) => updateStatusRule(template.id, "bottleneckDays", event.target.value)}
                    />
                  </label>
                  <label className="meta">
                    At Flow Risk Rule (days before due)
                    <input
                      className="input"
                      type="number"
                      value={rule.atRiskDays}
                      onChange={(event) => updateStatusRule(template.id, "atRiskDays", event.target.value)}
                    />
                  </label>
                  <label className="meta">
                    Overdue Rule (days past due)
                    <input
                      className="input"
                      type="number"
                      value={rule.overdueDays}
                      onChange={(event) => updateStatusRule(template.id, "overdueDays", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {activeTab === "billing-default" ? (
        <div className="grid" style={{ gap: 12 }}>
          {sortedTemplates.map((template) => {
            const billing = billingDefaults[template.id] ?? loadBillingDefault(template.id);
            return (
              <div key={template.id} className="template-card template-panel-placeholder">
                <h3 style={{ margin: 0 }}>{template.name}</h3>
                <div className="row">
                  <label className="meta">
                    Default Flat Fee
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={billing.flatFee}
                      onChange={(event) => updateBillingDefault(template.id, "flatFee", event.target.value)}
                    />
                  </label>
                  <label className="meta" style={{ minWidth: 260 }}>
                    Revenue Recognition Rule
                    <select
                      className="input"
                      value={billing.revenueRule}
                      onChange={(event) => updateBillingDefault(template.id, "revenueRule", event.target.value)}
                    >
                      <option>Deferred until close</option>
                      <option>Recognize at engagement</option>
                      <option>Milestone based</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
