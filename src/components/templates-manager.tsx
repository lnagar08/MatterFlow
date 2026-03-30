"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImportMattersModal } from "@/components/import-matters-modal";
import { redirect } from 'next/navigation';

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
  isTemplatePermission: boolean;
};

type TemplateTab = "workflow" | "status-rules" | "billing-default";

const DEFAULT_STATUS_RULE = { bottleneckDays: "14", atRiskDays: "3", overdueDays: "1" };
const DEFAULT_BILLING = { flatFee: "", revenueRule: "Deferred until close" };

function bySortOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function storageKey(templateId: string, key: "status-rules" | "billing-default") {
  return `matterflow.templates.${key}.${templateId}`;
}

export function TemplatesManager({ initialTemplates, isTemplatePermission }: Props) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [busy, setBusy] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(initialTemplates[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<TemplateTab>("workflow");
  const [importOpen, setImportOpen] = useState(false);
  const [draggingItem, setDraggingItem] = useState<{ type: "template" | "group" | "step"; id: string } | null>(null);
  const [stepDropTarget, setStepDropTarget] = useState<{ templateId: string; groupId: string; index: number } | null>(null);
  const [groupDropTarget, setGroupDropTarget] = useState<{ templateId: string; index: number } | null>(null);
  const draggedGroupIdRef = useRef<string | null>(null);
  const draggedStepIdRef = useRef<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savePopup, setSavePopup] = useState<string | null>(null);
  const [freshGroupId, setFreshGroupId] = useState<string | null>(null);
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(initialTemplates.map((template) => [template.id, template.groups.map((group) => group.id)]))
  );
  const [selectedGroupByTemplate, setSelectedGroupByTemplate] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialTemplates
          .map((template) => [template.id, bySortOrder(template.groups)[0]?.id ?? ""])
          .filter(([, groupId]) => Boolean(groupId))
      ) as Record<string, string>
  );
  const [statusRules, setStatusRules] = useState<Record<string, { bottleneckDays: string; atRiskDays: string; overdueDays: string }>>({});
  const [billingDefaults, setBillingDefaults] = useState<Record<string, { flatFee: string; revenueRule: string }>>({});

  function withUpdatedSortOrder<T extends { sortOrder: number }>(items: T[]): T[] {
    return items.map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }

  function pushReorderDebug(_message: string) {
    // tracker removed
  }

  function showSaved(message = "Changes saved.") {
    setSavePopup(message);
    window.setTimeout(() => {
      setSavePopup((current) => (current === message ? null : current));
    }, 2200);
  }

  function markUnsaved() {
    setHasUnsavedChanges(true);
  }

  async function saveAllChanges() {
    if (!hasUnsavedChanges || isSavingAll) return;

    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === "function") {
      active.blur();
    }

    setIsSavingAll(true);
    setBusy("save-all");
    pushReorderDebug("save start");
    try {
      const orderedTemplates = withUpdatedSortOrder(bySortOrder(templates));
      setTemplates(orderedTemplates);

      const templateOrderResponse = await fetch("/api/templates/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: orderedTemplates.map((template, index) => ({ id: template.id, sortOrder: index + 1 }))
        })
      });
      if (!templateOrderResponse.ok) {
        throw new Error("Failed to save FlowGuardian order.");
      }

      for (const template of orderedTemplates) {
        const groups = withUpdatedSortOrder(bySortOrder(template.groups));
        const steps = withUpdatedSortOrder(bySortOrder(template.steps));

        const nameResponse = await fetch(`/api/templates/${template.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: template.name })
        });
        if (!nameResponse.ok) {
          throw new Error(`Failed to save FlowGuardian "${template.name}".`);
        }

        for (const group of groups) {
          const groupResponse = await fetch(`/api/templates/groups/${group.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: group.title,
              indentLevel: group.indentLevel,
              expectedDurationDays: group.expectedDurationDays
            })
          });
          if (!groupResponse.ok) {
            throw new Error(`Failed to save Flow Stage "${group.title}".`);
          }
        }

        for (const step of steps) {
          const stepResponse = await fetch(`/api/templates/steps/${step.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: step.label,
              groupId: step.groupId,
              indentLevel: step.indentLevel,
              defaultDueDaysOffset: step.defaultDueDaysOffset
            })
          });
          if (!stepResponse.ok) {
            throw new Error(`Failed to save Flow Step "${step.label}".`);
          }
        }

        const reorderResponse = await fetch(`/api/templates/${template.id}/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupOrder: groups.map((group) => group.id),
            stepOrder: steps.map((step) => step.id)
          })
        });
        if (!reorderResponse.ok) {
          throw new Error(`Failed to save ordering for "${template.name}".`);
        }
      }

      await refreshTemplates();
      setHasUnsavedChanges(false);
      pushReorderDebug("save success");
      showSaved("All FlowGuardian changes saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save changes.";
      pushReorderDebug(`save failed: ${message}`);
      showSaved(message);
    } finally {
      setBusy(null);
      setIsSavingAll(false);
    }
  }

  const sortedTemplates = useMemo(() => bySortOrder(templates), [templates]);

  useEffect(() => {
    try {
      const nextStatusRules: Record<string, { bottleneckDays: string; atRiskDays: string; overdueDays: string }> = {};
      const nextBillingDefaults: Record<string, { flatFee: string; revenueRule: string }> = {};
      for (const template of templates) {
        const rawStatus = window.localStorage.getItem(storageKey(template.id, "status-rules"));
        if (rawStatus) {
          nextStatusRules[template.id] = JSON.parse(rawStatus) as {
            bottleneckDays: string;
            atRiskDays: string;
            overdueDays: string;
          };
        }

        const rawBilling = window.localStorage.getItem(storageKey(template.id, "billing-default"));
        if (rawBilling) {
          nextBillingDefaults[template.id] = JSON.parse(rawBilling) as { flatFee: string; revenueRule: string };
        }
      }

      if (Object.keys(nextStatusRules).length > 0) {
        setStatusRules((prev) => ({ ...prev, ...nextStatusRules }));
      }
      if (Object.keys(nextBillingDefaults).length > 0) {
        setBillingDefaults((prev) => ({ ...prev, ...nextBillingDefaults }));
      }
    } catch {
      // ignore storage read errors
    }
  }, [templates]);

  useEffect(() => {
    setSelectedGroupByTemplate((prev) => {
      const next = { ...prev };
      for (const template of templates) {
        const sortedGroups = bySortOrder(template.groups);
        if (sortedGroups.length === 0) {
          delete next[template.id];
          continue;
        }
        const current = next[template.id];
        const exists = current && sortedGroups.some((group) => group.id === current);
        if (!exists) {
          next[template.id] = sortedGroups[0].id;
        }
      }
      return next;
    });
  }, [templates]);

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

  async function createTemplate(name = "New FlowGuardian") {
    if(isTemplatePermission){
        redirect('/access-denied');
    }
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
      markUnsaved();
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
    markUnsaved();
    setBusy(null);
  }

  async function updateTemplateName(templateId: string, name: string) {
    setTemplates((prev) =>
      prev.map((template) => {
        if (template.id !== templateId) return template;
        const trimmed = name.trim();
        return trimmed ? { ...template, name: trimmed } : template;
      })
    );
    markUnsaved();
  }

  async function deleteTemplate(templateId: string) {
    setBusy(`delete-template-${templateId}`);
    await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
    await refreshTemplates();
    markUnsaved();
    setBusy(null);
  }

  async function addGroup(templateId: string) {
    setBusy(`add-group-${templateId}`);
    const response = await fetch(`/api/templates/${templateId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Flow Stage", indentLevel: 0, expectedDurationDays: null })
    });
    let createdGroupId: string | null = null;
    if (response.ok) {
      const data = (await response.json()) as { group?: TemplateGroup };
      createdGroupId = data.group?.id ?? null;
    }
    await refreshTemplates();
    setOpenTemplateId(templateId);
    if (createdGroupId) {
      setOpenGroupIds((prev) => {
        const existing = prev[templateId] ?? [];
        if (existing.includes(createdGroupId)) return prev;
        return { ...prev, [templateId]: [...existing, createdGroupId] };
      });
      setFreshGroupId(createdGroupId);
      window.setTimeout(() => {
        setFreshGroupId((current) => (current === createdGroupId ? null : current));
      }, 2600);
    }
    markUnsaved();
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
    markUnsaved();
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
    markUnsaved();
    setBusy(null);
  }

  async function updateGroup(
    groupId: string,
    payload: { title: string; indentLevel: number; expectedDurationDays: number | null }
  ) {
    setTemplates((prev) =>
      prev.map((template) => ({
        ...template,
        groups: template.groups.map((group) => (group.id === groupId ? { ...group, ...payload } : group))
      }))
    );
    markUnsaved();
  }

  async function deleteGroup(groupId: string) {
    setBusy(`delete-group-${groupId}`);
    await fetch(`/api/templates/groups/${groupId}`, { method: "DELETE" });
    await refreshTemplates();
    markUnsaved();
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
    setTemplates((prev) =>
      prev.map((template) => ({
        ...template,
        steps: template.steps.map((step) => (step.id === stepId ? { ...step, ...payload } : step))
      }))
    );
    markUnsaved();
  }

  async function deleteStep(stepId: string) {
    setBusy(`delete-step-${stepId}`);
    await fetch(`/api/templates/steps/${stepId}`, { method: "DELETE" });
    await refreshTemplates();
    markUnsaved();
    setBusy(null);
  }

  function onTemplateDrop(sourceId: string, targetId: string) {
    const sorted = bySortOrder(templates);
    const from = sorted.findIndex((template) => template.id === sourceId);
    const to = sorted.findIndex((template) => template.id === targetId);
    if (from < 0 || to < 0 || from === to) return;

    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const nextWithOrder = withUpdatedSortOrder(next);

    setTemplates(nextWithOrder);
    pushReorderDebug(`template reorder source=${sourceId.slice(0, 6)} target=${targetId.slice(0, 6)} dirty=true`);
    markUnsaved();
  }

  function onGroupDropAtIndex(templateId: string, sourceId: string, targetIndex: number) {
    let nextGroups: TemplateGroup[] | null = null;
    let nextSteps: TemplateStep[] | null = null;
    let changed = false;

    setTemplates((prev) =>
      prev.map((item) => {
        if (item.id !== templateId) return item;
        const sorted = bySortOrder(item.groups);
        const from = sorted.findIndex((group) => group.id === sourceId);
        if (from < 0) return item;
        const boundedTarget = Math.max(0, Math.min(targetIndex, sorted.length));

        const reordered = [...sorted];
        const [moved] = reordered.splice(from, 1);
        const insertAt = from < boundedTarget ? boundedTarget - 1 : boundedTarget;
        reordered.splice(insertAt, 0, moved);
        const reorderedWithOrder = withUpdatedSortOrder(reordered);
        changed = reorderedWithOrder.some((group, index) => group.id !== sorted[index]?.id);
        nextGroups = reorderedWithOrder;
        nextSteps = item.steps;
        return { ...item, groups: reorderedWithOrder };
      })
    );

    if (nextGroups && nextSteps && changed) {
      pushReorderDebug(`group reorder source=${sourceId.slice(0, 6)} index=${targetIndex} dirty=true`);
      markUnsaved();
    }
  }

  function onStepDropAtIndex(templateId: string, groupId: string, sourceId: string, targetIndex: number) {
    let nextGroups: TemplateGroup[] | null = null;
    let nextSteps: TemplateStep[] | null = null;
    let changed = false;

    setTemplates((prev) =>
      prev.map((item) => {
        if (item.id !== templateId) return item;
        const sortedAll = bySortOrder(item.steps);
        const fromAll = sortedAll.findIndex((step) => step.id === sourceId);
        if (fromAll < 0) {
          pushReorderDebug(`skip reorder: source not found source=${sourceId.slice(0, 6)}`);
          return item;
        }
        const sourceStep = sortedAll[fromAll];
        const sourceGroupId = sourceStep.groupId ?? "";
        const sourceGroupSteps = sortedAll.filter((step) => (step.groupId ?? "") === sourceGroupId);
        const sourceGroupIndex = sourceGroupSteps.findIndex((step) => step.id === sourceId);

        const working = [...sortedAll];
        const [movedRaw] = working.splice(fromAll, 1);
        const moved: TemplateStep = { ...movedRaw, groupId };

        const targetGroupSteps = working.filter((step) => step.groupId === groupId);
        const boundedTarget = Math.max(0, Math.min(targetIndex, targetGroupSteps.length));
        const intendedChange = sourceGroupId !== groupId || sourceGroupIndex !== boundedTarget;
        let insertAt = -1;

        if (targetGroupSteps.length > 0) {
          if (boundedTarget >= targetGroupSteps.length) {
            const lastInGroupId = targetGroupSteps[targetGroupSteps.length - 1].id;
            const lastIndex = working.findIndex((step) => step.id === lastInGroupId);
            insertAt = lastIndex + 1;
          } else {
            const anchorId = targetGroupSteps[boundedTarget].id;
            insertAt = working.findIndex((step) => step.id === anchorId);
          }
        } else {
          const groupsByOrder = bySortOrder(item.groups);
          const targetGroup = groupsByOrder.find((group) => group.id === groupId);
          if (!targetGroup) {
            pushReorderDebug(`skip reorder: target group not found group=${groupId.slice(0, 6)}`);
            return item;
          }
          const targetSort = targetGroup.sortOrder;
          const groupSortById = new Map(groupsByOrder.map((group) => [group.id, group.sortOrder]));
          const prevSteps = working.filter((step) => {
            if (!step.groupId) return false;
            const sort = groupSortById.get(step.groupId);
            return typeof sort === "number" && sort < targetSort;
          });
          if (prevSteps.length > 0) {
            const lastPrevId = prevSteps[prevSteps.length - 1].id;
            const lastPrevIndex = working.findIndex((step) => step.id === lastPrevId);
            insertAt = lastPrevIndex + 1;
          } else {
            const nextStep = working.find((step) => {
              if (!step.groupId) return false;
              const sort = groupSortById.get(step.groupId);
              return typeof sort === "number" && sort > targetSort;
            });
            if (nextStep) {
              insertAt = working.findIndex((step) => step.id === nextStep.id);
            } else {
              insertAt = working.length;
            }
          }
        }

        if (insertAt < 0 || insertAt > working.length) {
          pushReorderDebug(`skip reorder: invalid insert index=${insertAt}`);
          return item;
        }

        working.splice(insertAt, 0, moved);
        const nextAllWithOrder = withUpdatedSortOrder(working);
        changed =
          intendedChange ||
          nextAllWithOrder.some((step, index) => step.id !== sortedAll[index]?.id || step.groupId !== sortedAll[index]?.groupId);

        nextGroups = item.groups;
        nextSteps = nextAllWithOrder;
        return { ...item, steps: nextAllWithOrder };
      })
    );

    if (nextGroups && nextSteps && changed) {
      pushReorderDebug(`drop source=${sourceId.slice(0, 6)} group=${groupId.slice(0, 6)} targetIndex=${targetIndex}`);
      pushReorderDebug("dirty=true");
      markUnsaved();
    } else {
      pushReorderDebug("drop no-op (unchanged order)");
    }
  }

  function resolveTargetIndexFromEvent(
    event: React.DragEvent<HTMLElement>,
    groupId: string,
    groupStepsLength: number
  ) {
    const target = event.target as HTMLElement | null;
    const row = target?.closest<HTMLElement>("[data-template-step-row='true']");
    if (!row) return groupStepsLength;
    const rowGroupId = row.dataset.groupId ?? "";
    if (rowGroupId !== groupId) return groupStepsLength;
    const index = Number(row.dataset.stepIndex ?? "-1");
    if (!Number.isFinite(index) || index < 0) return groupStepsLength;
    const rect = row.getBoundingClientRect();
    const halfway = rect.top + rect.height / 2;
    return event.clientY <= halfway ? index : index + 1;
  }

  function readDraggedStepId(dataTransferText: string) {
    if (draggedStepIdRef.current) return draggedStepIdRef.current;
    if (draggingItem?.type === "step") return draggingItem.id;
    if (dataTransferText.startsWith("step:")) return dataTransferText.replace("step:", "");
    return "";
  }

  function readDraggedGroupId(dataTransfer: DataTransfer | null) {
    if (draggedGroupIdRef.current) return draggedGroupIdRef.current;
    if (draggingItem?.type === "group") return draggingItem.id;
    const groupData =
      dataTransfer?.getData("application/x-matterflow-group") ||
      dataTransfer?.getData("text/plain") ||
      "";
    if (groupData.startsWith("group:")) return groupData.replace("group:", "");
    return "";
  }

  function startGroupDrag(event: React.DragEvent<HTMLElement>, groupId: string) {
    event.stopPropagation();
    setDraggingItem({ type: "group", id: groupId });
    draggedGroupIdRef.current = groupId;
    draggedStepIdRef.current = null;
    setStepDropTarget(null);
    markUnsaved();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-matterflow-group", `group:${groupId}`);
    event.dataTransfer.setData("text/plain", `group:${groupId}`);
  }

  function toggleGroup(templateId: string, groupId: string) {
    setOpenGroupIds((prev) => {
      const current = prev[templateId] ?? [];
      const next = current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId];
      return { ...prev, [templateId]: next };
    });
  }

  function loadStatusRule(templateId: string) {
    return statusRules[templateId] ?? DEFAULT_STATUS_RULE;
  }

  function loadBillingDefault(templateId: string) {
    return billingDefaults[templateId] ?? DEFAULT_BILLING;
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
        <div className="templates-view-tabs" role="tablist" aria-label="FlowGuardian views">
          <button
            type="button"
            className={`templates-view-tab ${activeTab === "workflow" ? "active" : ""}`}
            onClick={() => setActiveTab("workflow")}
          >
            Flow Stages
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
          <div className="templates-control-group templates-control-group-save">
            <button
              type="button"
              className="button primary"
              disabled={!hasUnsavedChanges || isSavingAll}
              aria-disabled={!hasUnsavedChanges || isSavingAll}
              onClick={() => void saveAllChanges()}
            >
              {isSavingAll ? "Saving..." : "Save Changes"}
            </button>
            <span className="meta" aria-live="polite">
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>

          <span className="templates-control-separator" aria-hidden="true" />

          <div className="templates-control-group templates-control-group-tools">
            <button type="button" className="button" onClick={() => setImportOpen(true)}>
              Import CSV
            </button>
            <button type="button" className="button nav-pill" onClick={() => setReorderMode((value) => !value)}>
              Reorder Mode: {reorderMode ? "On" : "Off"}
            </button>
          </div>
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
                draggable={reorderMode && !isOpen}
                onDragStart={(event) => {
                  if (isOpen) return;
                  setDraggingItem({ type: "template", id: template.id });
                  markUnsaved();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", `template:${template.id}`);
                }}
                onDragEnd={() => {
                  if (draggingItem?.type === "template") {
                    setDraggingItem(null);
                  }
                }}
                onDragOver={(event) => {
                  if (!reorderMode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  if (!reorderMode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const data = event.dataTransfer.getData("text/plain");
                  const sourceId =
                    draggingItem?.type === "template" ? draggingItem.id : data.startsWith("template:") ? data.replace("template:", "") : "";
                  if (!sourceId) return;
                  onTemplateDrop(sourceId, template.id);
                  setDraggingItem(null);
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
                    {reorderMode ? <span className="template-drag-handle" aria-label="Drag FlowGuardian">⋮⋮</span> : null}
                    <button
                      type="button"
                      className="button btn-secondary-soft"
                      disabled={busy === `duplicate-${template.id}`}
                      onClick={() => duplicateTemplate(template)}
                    >
                    {busy === `duplicate-${template.id}` ? "Duplicating..." : "Duplicate FlowGuardian"}
                    </button>
                    <button
                      type="button"
                      className="button btn-danger-ghost"
                      title="Delete FlowGuardian"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4.687 6.21311L6.8 18.9761C6.89665 19.5604 7.19759 20.0914 7.6492 20.4745C8.10081 20.8576 8.67377 21.068 9.266 21.0681H12.614M19.312 6.21311L17.2 18.9761C17.1033 19.5604 16.8024 20.0914 16.3508 20.4745C15.8992 20.8576 15.3262 21.068 14.734 21.0681H11.386M10.022 11.1161V16.1651M13.978 11.1161V16.1651M2.75 6.21311H21.25M14.777 6.21311V4.43311C14.777 4.03528 14.619 3.65375 14.3377 3.37245C14.0564 3.09114 13.6748 2.93311 13.277 2.93311H10.723C10.3252 2.93311 9.94364 3.09114 9.66234 3.37245C9.38104 3.65375 9.223 4.03528 9.223 4.43311V6.21311H14.777Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    </button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="template-section template-blueprint-body">
                    {(() => {
                      const selectedGroupId = selectedGroupByTemplate[template.id] ?? groups[0]?.id ?? "";
                      const selectedGroupIndex = groups.findIndex((group) => group.id === selectedGroupId);
                      return !reorderMode && groups.length > 0 ? (
                        <div className="template-stage-timeline">
                          <div className="template-stage-timeline-track" aria-hidden="true" />
                          <div className="template-stage-timeline-scroll" role="tablist" aria-label="Flow Stage timeline">
                            {groups.map((group, index) => {
                              const isSelected = group.id === selectedGroupId;
                              const isCompleted = selectedGroupIndex > -1 && index < selectedGroupIndex;
                              return (
                                <button
                                  key={group.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={isSelected}
                                  className={`template-stage-node ${isSelected ? "selected" : ""} ${isCompleted ? "completed" : ""}`}
                                  onClick={() => setSelectedGroupByTemplate((prev) => ({ ...prev, [template.id]: group.id }))}
                                >
                                  <span className="template-stage-node-dot" aria-hidden="true" />
                                  <span className="template-stage-node-label">{group.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    <div className="row template-actions-inline">
                      <input
                        className="input"
                        defaultValue={template.name}
                        onChange={markUnsaved}
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
                      {(reorderMode
                        ? groups
                        : groups.filter((group) => group.id === (selectedGroupByTemplate[template.id] ?? groups[0]?.id ?? ""))
                      ).map((group, groupIndex) => {
                        const groupSteps = steps.filter((step) => step.groupId === group.id);
                        const isOpenGroup = reorderMode ? (openGroupIds[template.id] ?? []).includes(group.id) : true;
                        const groupDragMode = reorderMode && !draggedStepIdRef.current && (draggingItem?.type === "group" || !draggingItem);
                        const groupDropActive =
                          groupDragMode &&
                          groupDropTarget?.templateId === template.id &&
                          groupDropTarget?.index === groupIndex;
                        const stepDragMode = reorderMode && (!!draggedStepIdRef.current || draggingItem?.type === "step");
                        return (
                          <div key={group.id}>
                            {reorderMode ? (
                              <div
                                className={`template-group-drop-zone ${groupDropActive ? "active" : ""}`}
                                aria-label="Drop Flow Stage here"
                                onDragOver={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  event.dataTransfer.dropEffect = "move";
                                  setGroupDropTarget({ templateId: template.id, index: groupIndex });
                                }}
                                onDragEnter={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setGroupDropTarget({ templateId: template.id, index: groupIndex });
                                }}
                                onDrop={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const sourceId = readDraggedGroupId(event.dataTransfer);
                                  if (!sourceId) return;
                                  onGroupDropAtIndex(template.id, sourceId, groupIndex);
                                  setDraggingItem(null);
                                  setGroupDropTarget(null);
                                  draggedGroupIdRef.current = null;
                                }}
                              >
                                <span className="template-group-drop-zone-label">Drop Flow Stage here</span>
                              </div>
                            ) : null}
                            <div
                              className={`template-group-card ${freshGroupId === group.id ? "fresh-stage" : ""} ${groupDropActive ? "drop-active" : ""} ${
                                reorderMode ? "" : "stage-editor-card"
                              }`}
                              draggable={false}
                              onDragEnd={() => {
                                if (draggingItem?.type === "group") {
                                  setDraggingItem(null);
                                }
                                setGroupDropTarget(null);
                                draggedGroupIdRef.current = null;
                              }}
                            >
                            <button
                              type="button"
                              className="template-group-header"
                              onClick={() => {
                                if (reorderMode) return;
                                setSelectedGroupByTemplate((prev) => ({ ...prev, [template.id]: group.id }));
                              }}
                            >
                              {reorderMode ? (
                                <span
                                  className="template-group-drag-handle"
                                  aria-label="Drag Flow Stage"
                                  draggable
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onDragStart={(event) => startGroupDrag(event, group.id)}
                                  onDragEnd={() => {
                                    if (draggingItem?.type === "group") {
                                      setDraggingItem(null);
                                    }
                                    setGroupDropTarget(null);
                                    draggedGroupIdRef.current = null;
                                  }}
                                >
                                  ⋮⋮
                                </span>
                              ) : null}
                              <span>{group.title}</span>
                              <span className="meta">{`Expected: ${group.expectedDurationDays ?? "—"}d`}</span>
                              <span className="meta">{groupSteps.length} Flow Steps</span>
                              {reorderMode ? <span className={`chevron ${isOpenGroup ? "open" : ""}`}>▸</span> : null}
                            </button>

                            {isOpenGroup ? (
                              <div className="template-group-body">
                                <div className="row">
                                  <input
                                    className="input"
                                    defaultValue={group.title}
                                    onChange={markUnsaved}
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
                                      onChange={markUnsaved}
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

                                <div
                                  className="grid"
                                  style={{ gap: 8 }}
                                  onDragOver={(event) => {
                                    if (!stepDragMode) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.dataTransfer.dropEffect = "move";
                                    const nextIndex = resolveTargetIndexFromEvent(event, group.id, groupSteps.length);
                                    setStepDropTarget({ templateId: template.id, groupId: group.id, index: nextIndex });
                                  }}
                                  onDrop={(event) => {
                                    if (!stepDragMode) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const sourceId = readDraggedStepId(
                                      event.dataTransfer.getData("application/x-matterflow-step") ||
                                        event.dataTransfer.getData("text/plain")
                                    );
                                    if (!sourceId) return;
                                    const nextIndex = resolveTargetIndexFromEvent(event, group.id, groupSteps.length);
                                    pushReorderDebug(
                                      `container drop source=${sourceId.slice(0, 6)} group=${group.id.slice(0, 6)} index=${nextIndex}`
                                    );
                                    onStepDropAtIndex(template.id, group.id, sourceId, nextIndex);
                                    setDraggingItem(null);
                                    setStepDropTarget(null);
                                    draggedStepIdRef.current = null;
                                  }}
                                >
                                  <p className="meta" style={{ margin: 0 }}>
                                    Default due (+days) sets the suggested due date after the prior Flow Step is completed.
                                  </p>
                                  {groupSteps.map((step, index) => (
                                    <div key={step.id}>
                                      {stepDragMode ? (
                                        <div
                                          className={`template-step-drop-zone ${
                                            stepDropTarget?.templateId === template.id &&
                                            stepDropTarget?.groupId === group.id &&
                                            stepDropTarget?.index === index
                                              ? "active"
                                              : ""
                                          }`}
                                          onDragOver={(event) => {
                                            if (!stepDragMode) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            event.dataTransfer.dropEffect = "move";
                                            setStepDropTarget({ templateId: template.id, groupId: group.id, index });
                                          }}
                                          onDragEnter={(event) => {
                                            if (!stepDragMode) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setStepDropTarget({ templateId: template.id, groupId: group.id, index });
                                          }}
                                          onDrop={(event) => {
                                            if (!stepDragMode) return;
                                            event.preventDefault();
                                            event.stopPropagation();
                                            const sourceId = readDraggedStepId(
                                              event.dataTransfer.getData("application/x-matterflow-step") ||
                                                event.dataTransfer.getData("text/plain")
                                            );
                                            if (!sourceId) return;
                                            onStepDropAtIndex(template.id, group.id, sourceId, index);
                                            setDraggingItem(null);
                                            setStepDropTarget(null);
                                          }}
                                        />
                                      ) : null}

                                      <div
                                        className="list-item template-step-row"
                                        data-template-step-row="true"
                                        data-group-id={group.id}
                                        data-step-index={index}
                                        draggable={reorderMode}
                                        onDragOver={(event) => {
                                          if (!stepDragMode) return;
                                          event.preventDefault();
                                          event.stopPropagation();
                                          event.dataTransfer.dropEffect = "move";
                                          const nextIndex = resolveTargetIndexFromEvent(event, group.id, groupSteps.length);
                                          setStepDropTarget({ templateId: template.id, groupId: group.id, index: nextIndex });
                                        }}
                                        onDragEnter={(event) => {
                                          if (!stepDragMode) return;
                                          event.preventDefault();
                                          event.stopPropagation();
                                          const nextIndex = resolveTargetIndexFromEvent(event, group.id, groupSteps.length);
                                          setStepDropTarget({ templateId: template.id, groupId: group.id, index: nextIndex });
                                        }}
                                        onDrop={(event) => {
                                          if (!stepDragMode) return;
                                          event.preventDefault();
                                          event.stopPropagation();
                                          const sourceId = readDraggedStepId(
                                            event.dataTransfer.getData("application/x-matterflow-step") ||
                                              event.dataTransfer.getData("text/plain")
                                          );
                                          if (!sourceId) return;
                                          const nextIndex = resolveTargetIndexFromEvent(event, group.id, groupSteps.length);
                                          pushReorderDebug(
                                            `row drop source=${sourceId.slice(0, 6)} group=${group.id.slice(0, 6)} index=${nextIndex}`
                                          );
                                          onStepDropAtIndex(template.id, group.id, sourceId, nextIndex);
                                          setDraggingItem(null);
                                          setStepDropTarget(null);
                                          draggedStepIdRef.current = null;
                                        }}
                                        onDragStart={(event) => {
                                          event.stopPropagation();
                                          setDraggingItem({ type: "step", id: step.id });
                                          markUnsaved();
                                          draggedStepIdRef.current = step.id;
                                          setStepDropTarget(null);
                                          pushReorderDebug(`drag start step=${step.id.slice(0, 6)}`);
                                          event.dataTransfer.effectAllowed = "move";
                                          event.dataTransfer.setData("application/x-matterflow-step", step.id);
                                          event.dataTransfer.setData("text/plain", `step:${step.id}`);
                                        }}
                                        onDragEnd={() => {
                                          pushReorderDebug(
                                            `drag end source=${(draggedStepIdRef.current ?? "none").slice(0, 6)} target=${
                                              stepDropTarget
                                                ? `${stepDropTarget.groupId.slice(0, 6)}:${stepDropTarget.index}`
                                                : "none"
                                            }`
                                          );
                                          const draggedStepId = draggedStepIdRef.current;
                                          if (
                                            reorderMode &&
                                            !!draggedStepId &&
                                            stepDropTarget &&
                                            stepDropTarget.templateId === template.id
                                          ) {
                                            pushReorderDebug(
                                              `drag end fallback source=${draggedStepId.slice(0, 6)} group=${stepDropTarget.groupId.slice(0, 6)} index=${stepDropTarget.index}`
                                            );
                                            onStepDropAtIndex(
                                              template.id,
                                              stepDropTarget.groupId,
                                              draggedStepId,
                                              stepDropTarget.index
                                            );
                                          }
                                          setDraggingItem(null);
                                          setStepDropTarget(null);
                                          draggedStepIdRef.current = null;
                                        }}
                                      >
                                        <div className="row template-step-clean-row">
                                          <span className="pill">{`#${index + 1}`}</span>
                                          <input
                                            className="input"
                                            defaultValue={step.label}
                                            onChange={markUnsaved}
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
                                              onChange={markUnsaved}
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
                                        <div className="row" style={{ gap: 6 }}>
                                          <button
                                            type="button"
                                            className="button"
                                            disabled={step.indentLevel <= 0}
                                            onClick={() =>
                                              updateStep(step.id, {
                                                label: step.label,
                                                groupId: step.groupId,
                                                indentLevel: Math.max(0, step.indentLevel - 1),
                                                defaultDueDaysOffset: step.defaultDueDaysOffset
                                              })
                                            }
                                            title="Decrease indent"
                                            aria-label="Decrease indent"
                                          >
                                            ←
                                          </button>
                                          <button
                                            type="button"
                                            className="button"
                                            disabled={step.indentLevel >= 5}
                                            onClick={() =>
                                              updateStep(step.id, {
                                                label: step.label,
                                                groupId: step.groupId,
                                                indentLevel: Math.min(5, step.indentLevel + 1),
                                                defaultDueDaysOffset: step.defaultDueDaysOffset
                                              })
                                            }
                                            title="Increase indent"
                                            aria-label="Increase indent"
                                          >
                                            →
                                          </button>
                                        </div>
                                        <span className="meta"><strong>Depends on:</strong> Prior Flow Step</span>
                                        <button className="icon-danger" onClick={() => deleteStep(step.id)} title="Delete Flow Step">
                                          ×
                                        </button>
                                      </div>
                                      </div>
                                    </div>
                                  ))}
                                  {stepDragMode ? (
                                    <div
                                      className={`template-step-drop-zone ${
                                        stepDropTarget?.templateId === template.id &&
                                        stepDropTarget?.groupId === group.id &&
                                        stepDropTarget?.index === groupSteps.length
                                          ? "active"
                                          : ""
                                      }`}
                                      onDragOver={(event) => {
                                        if (!stepDragMode) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.dataTransfer.dropEffect = "move";
                                        setStepDropTarget({ templateId: template.id, groupId: group.id, index: groupSteps.length });
                                      }}
                                      onDragEnter={(event) => {
                                        if (!stepDragMode) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setStepDropTarget({ templateId: template.id, groupId: group.id, index: groupSteps.length });
                                      }}
                                      onDrop={(event) => {
                                        if (!stepDragMode) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        const sourceId = readDraggedStepId(
                                          event.dataTransfer.getData("application/x-matterflow-step") ||
                                            event.dataTransfer.getData("text/plain")
                                        );
                                        if (!sourceId) return;
                                        onStepDropAtIndex(template.id, group.id, sourceId, groupSteps.length);
                                        setDraggingItem(null);
                                        setStepDropTarget(null);
                                        draggedStepIdRef.current = null;
                                      }}
                                    />
                                  ) : null}
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
                            {reorderMode && groupIndex === groups.length - 1 ? (
                              <div
                                className={`template-group-drop-zone ${
                                  groupDropTarget?.templateId === template.id && groupDropTarget.index === groups.length ? "active" : ""
                                }`}
                                aria-label="Drop Flow Stage here"
                                onDragOver={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  event.dataTransfer.dropEffect = "move";
                                  setGroupDropTarget({ templateId: template.id, index: groups.length });
                                }}
                                onDragEnter={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setGroupDropTarget({ templateId: template.id, index: groups.length });
                                }}
                                onDrop={(event) => {
                                  if (draggedStepIdRef.current) return;
                                  if (draggingItem && draggingItem.type !== "group") return;
                                  event.preventDefault();
                                  event.stopPropagation();
                                  const sourceId = readDraggedGroupId(event.dataTransfer);
                                  if (!sourceId) return;
                                  onGroupDropAtIndex(template.id, sourceId, groups.length);
                                  setDraggingItem(null);
                                  setGroupDropTarget(null);
                                  draggedGroupIdRef.current = null;
                                }}
                              >
                                <span className="template-group-drop-zone-label">Drop Flow Stage here</span>
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

          <div className="template-action-box">
            <button className="button primary templates-add-btn" onClick={() => createTemplate()} disabled={busy === "create-template"}>
            {busy === "create-template" ? "Adding..." : "+ Add New FlowGuardian"}
          </button>
          </div>
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
                  <div className="col-6">
                    <div className="form-group">
                      <label className="meta">
                        Out of Flow Rule (days in Flow Step)
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={rule.bottleneckDays}
                          onChange={(event) => updateStatusRule(template.id, "bottleneckDays", event.target.value)}
                        />
                      
                    </div>
                  </div>
                  
                  <div className="col-6">
                    <div className="form-group">
                      <label className="meta">
                        At Flow Risk Rule (days before due)
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={rule.atRiskDays}
                          onChange={(event) => updateStatusRule(template.id, "atRiskDays", event.target.value)}
                        />
                      
                    </div>
                  </div>
                  
                  <div className="col-12">
                    <div className="form-group">
                      <label className="meta">
                        Overdue Rule (days past due)
                        </label>
                        <input
                          className="input"
                          type="number"
                          value={rule.overdueDays}
                          onChange={(event) => updateStatusRule(template.id, "overdueDays", event.target.value)}
                        />
                      
                    </div>
                  </div>
                  
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
                 
                  <div className="col-6">
                    <div className="form-group">
                      <label className="meta">
                        Default Flat Fee
                        </label>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          value={billing.flatFee}
                          onChange={(event) => updateBillingDefault(template.id, "flatFee", event.target.value)}
                        />
                      
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="form-group">
                      <label className="meta" style={{ minWidth: 260 }}>
                        Revenue Recognition Rule
                        </label>
                        <select
                          className="input"
                          value={billing.revenueRule}
                          onChange={(event) => updateBillingDefault(template.id, "revenueRule", event.target.value)}
                        >
                          <option>Deferred until close</option>
                          <option>Recognize at engagement</option>
                          <option>Milestone based</option>
                        </select>
                      
                    </div>
                  </div>
                  
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ImportMattersModal open={importOpen} onClose={() => setImportOpen(false)} />
      {savePopup ? (
        <div className="templates-save-popup" role="status" aria-live="polite">
          {savePopup}
        </div>
      ) : null}
    </div>
  );
}
