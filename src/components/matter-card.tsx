"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { diffInDays } from "@/lib/matter-flags";
import { getGroupProgressStart, parseGroupProgress } from "@/lib/group-progress";
import { isOverdue, overdueDays, resolveStepDueDate } from "@/lib/step-overdue";

type ChecklistStep = {
  id: string;
  label: string;
  completed: boolean;
  indentLevel: number;
  dueDaysOffset: number | null;
  dueAt: string | null;
};

type ChecklistGroup = {
  id: string;
  title: string;
  indentLevel: number;
  expectedDurationDays: number | null;
  steps: ChecklistStep[];
};

type MatterCardProps = {
  matterId: string;
  clientName: string;
  companyName: string;
  clientLogoUrl: string;
  engagementDate: string;
  engagementDateValue: string;
  matterCreatedAtValue: string;
  defaultGroupExpectedDays: number;
  groupGraceDays: number;
  groupProgress?: unknown;
  bottleneckMeta?: {
    groupName: string | null;
    expectedDays: number | null;
    elapsedDays: number | null;
    graceDays: number;
  };
  isPenaltyBox?: boolean;
  penaltyDaysOpen?: number;
  penaltyThreshold?: number;
  amountPaid: string;
  blurb: string;
  checklistGroups: ChecklistGroup[];
  ungroupedSteps: ChecklistStep[];
  highlightedStepIds?: string[];
  penaltyReason?: string | null;
  previousHref: string | null;
  nextHref: string | null;
};

export function MatterCard(props: MatterCardProps) {
  const {
    matterId,
    clientName,
    companyName,
    clientLogoUrl,
    engagementDate,
    engagementDateValue,
    matterCreatedAtValue,
    defaultGroupExpectedDays,
    groupGraceDays,
    groupProgress,
    bottleneckMeta,
    isPenaltyBox = false,
    penaltyDaysOpen = 0,
    penaltyThreshold = 0,
    amountPaid,
    blurb,
    checklistGroups,
    ungroupedSteps,
    highlightedStepIds = [],
    penaltyReason = null,
    previousHref,
    nextHref
  } = props;
  const [groupsState, setGroupsState] = useState(checklistGroups);
  const [ungroupedState, setUngroupedState] = useState(ungroupedSteps);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [openDuePickerStepId, setOpenDuePickerStepId] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<string[]>([
    ...checklistGroups.map((group) => group.id),
    "__ungrouped__"
  ]);
  const overdueStepRefs = useRef<Record<string, HTMLLabelElement | null>>({});

  useEffect(() => {
    setGroupsState(checklistGroups);
    setUngroupedState(ungroupedSteps);
    setOpenGroups([...checklistGroups.map((group) => group.id), "__ungrouped__"]);
  }, [checklistGroups, ungroupedSteps]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  }

  function formatDateForInput(value: string | null) {
    if (!value) {
      return "";
    }
    return new Date(value).toISOString().slice(0, 10);
  }

  function asFriendlyDate(value: string) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function updateStep(stepId: string, updater: (step: ChecklistStep) => ChecklistStep) {
    setGroupsState((prev) =>
      prev.map((group) => ({
        ...group,
        steps: group.steps.map((step) => (step.id === stepId ? updater(step) : step))
      }))
    );
    setUngroupedState((prev) => prev.map((step) => (step.id === stepId ? updater(step) : step)));
  }

  async function onToggleStep(stepId: string, completed: boolean) {
    const wasPending = pendingIds.includes(stepId);
    if (wasPending) {
      return;
    }

    setPendingIds((prev) => [...prev, stepId]);

    const previousGroups = groupsState;
    const previousUngrouped = ungroupedState;

    updateStep(stepId, (step) => ({ ...step, completed }));

    const response = await fetch(`/api/matters/${matterId}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed })
    });

    if (!response.ok) {
      setGroupsState(previousGroups);
      setUngroupedState(previousUngrouped);
    }

    setPendingIds((prev) => prev.filter((id) => id !== stepId));
  }

  async function onSetDueDate(stepId: string, dueAt: string | null) {
    const wasPending = pendingIds.includes(stepId);
    if (wasPending) {
      return;
    }

    setPendingIds((prev) => [...prev, stepId]);
    const previousGroups = groupsState;
    const previousUngrouped = ungroupedState;

    const dueAtIso = dueAt ? new Date(`${dueAt}T00:00:00.000Z`).toISOString() : null;
    updateStep(stepId, (step) => ({ ...step, dueAt: dueAtIso }));

    const response = await fetch(`/api/matters/${matterId}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: dueAtIso })
    });

    if (!response.ok) {
      setGroupsState(previousGroups);
      setUngroupedState(previousUngrouped);
    }

    setPendingIds((prev) => prev.filter((id) => id !== stepId));
  }

  const dueContext = useMemo(
    () => ({
      engagementDate: engagementDateValue,
      createdAt: matterCreatedAtValue
    }),
    [engagementDateValue, matterCreatedAtValue]
  );
  const parsedGroupProgress = useMemo(() => parseGroupProgress(groupProgress), [groupProgress]);
  const currentGroupId = useMemo(
    () => groupsState.find((group) => group.steps.some((step) => !step.completed))?.id ?? null,
    [groupsState]
  );

  function getOverdueState(step: ChecklistStep) {
    const overdue = isOverdue(
      {
        completed: step.completed,
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset
      },
      dueContext
    );
    const daysLate = overdueDays(
      {
        completed: step.completed,
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset
      },
      dueContext
    );
    const dueDate = resolveStepDueDate(
      {
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset
      },
      dueContext
    );
    return { overdue, daysLate, dueDate };
  }

  function scrollToStep(stepId: string) {
    const el = overdueStepRefs.current[stepId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderStep(step: ChecklistStep, groupId?: string) {
    const isPending = pendingIds.includes(step.id);
    const isHighlighted = highlightedStepIds.includes(step.id);
    const hasCustomDueAt = Boolean(step.dueAt);
    const isDatePickerOpen = openDuePickerStepId === step.id;
    const { overdue, daysLate, dueDate } = getOverdueState(step);
    const rowIsOverdue = overdue || isHighlighted;

    return (
      <label
        className={`checklist-step ${rowIsOverdue ? "penalty-highlight overdue-step" : ""}`}
        key={step.id}
        ref={(element) => {
          if (groupId && overdue) {
            overdueStepRefs.current[`${groupId}:${step.id}`] = element;
          }
        }}
        aria-label={overdue ? `${step.label} overdue by ${daysLate} days` : step.label}
        style={{ paddingLeft: `${step.indentLevel * 20}px` }}
      >
        <input
          className="step-checkbox"
          type="checkbox"
          checked={step.completed}
          disabled={isPending}
          onChange={(event) => onToggleStep(step.id, event.target.checked)}
        />
        <span className="step-label-wrap">
          <span className="step-title">{step.label}</span>
          {dueDate ? (
            <span className="step-meta">
              {`Due ${asFriendlyDate(dueDate.toISOString())}`}
              {overdue ? ` • Overdue by ${daysLate} ${daysLate === 1 ? "day" : "days"}` : ""}
            </span>
          ) : hasCustomDueAt ? (
            <span className="step-meta">{`Due ${asFriendlyDate(step.dueAt as string)}`}</span>
          ) : step.dueDaysOffset !== null ? (
            <span className="step-meta">{`Default due +${step.dueDaysOffset}d`}</span>
          ) : null}
        </span>
        {overdue ? (
          <span className="status overdue step-overdue-badge" aria-label={`Overdue by ${daysLate} days`}>
            {`Overdue • ${daysLate}d`}
          </span>
        ) : null}
        <button
          type="button"
          className="icon-button due-chip"
          aria-label="Set due date"
          title="Set due date"
          disabled={isPending}
          onClick={() => setOpenDuePickerStepId((prev) => (prev === step.id ? null : step.id))}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9ZM5 6a1 1 0 0 0-1 1v1h16V7a1 1 0 0 0-1-1H5Z"
            />
          </svg>
        </button>
        {isDatePickerOpen ? (
          <span className="row due-edit-row">
            <input
              type="date"
              className="input due-date-input"
              value={formatDateForInput(step.dueAt)}
              disabled={isPending}
              onChange={(event) => onSetDueDate(step.id, event.target.value || null)}
            />
            <button
              type="button"
              className="button btn-secondary-soft"
              disabled={isPending}
              onClick={() => onSetDueDate(step.id, null)}
            >
              Clear
            </button>
          </span>
        ) : null}
      </label>
    );
  }

  return (
    <div className="matter-detail grid">
      <section className="glass-card matter-summary">
        <div className="row matter-summary-head">
          <Image
            src={clientLogoUrl}
            alt={`${clientName} logo`}
            width={56}
            height={56}
            className="logo"
          />
          <div className="matter-summary-id">
            <h2 style={{ margin: 0 }}>{clientName}</h2>
            <div className="meta matter-company">{companyName}</div>
          </div>
        </div>
        <div className="row matter-meta-row">
          <div className="pill">Engagement Date: {engagementDate}</div>
          <div className="pill">Amount Paid: {amountPaid}</div>
        </div>
        <p className="matter-blurb">{blurb}</p>
      </section>
      {penaltyReason ? (
        <div className="card matter-penalty-note">
          <strong style={{ color: "#dc3545" }}>Flow Breakdown Reason:</strong> {penaltyReason}
          {isPenaltyBox ? (
            <div className="meta" style={{ marginTop: 4 }}>
              {`Open for ${penaltyDaysOpen} days (limit ${penaltyThreshold})`}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid">
        {groupsState.map((group) => {
          const overdueSteps = group.steps.filter((step) => getOverdueState(step).overdue);
          const firstOverdueStep = overdueSteps[0];
          const derivedExpectedDays =
            group.steps
              .map((step) => step.dueDaysOffset)
              .filter((offset): offset is number => typeof offset === "number" && offset >= 0)
              .reduce((max, offset) => Math.max(max, offset), 0) || null;
          const expectedDays = group.expectedDurationDays ?? derivedExpectedDays ?? defaultGroupExpectedDays;
          const groupStart = getGroupProgressStart(
            parsedGroupProgress,
            group.id,
            new Date(engagementDateValue || matterCreatedAtValue)
          );
          const elapsedDays = diffInDays(new Date(), groupStart);
          const groupIsCurrent = currentGroupId === group.id;
          const groupIsBottleneck = groupIsCurrent && elapsedDays > expectedDays + groupGraceDays;

          return (
            <section key={group.id} className="checklist-group" style={{ marginLeft: `${group.indentLevel * 20}px` }}>
            <button
              type="button"
              className="checklist-group-header"
              onClick={() => toggleGroup(group.id)}
            >
              <span className="checklist-group-title-wrap">
                <span>{group.title}</span>
                <span className="pill">Flow Stage Expected: {expectedDays}d</span>
                {groupIsCurrent ? <span className="pill">Elapsed: {elapsedDays}d</span> : null}
                {groupIsBottleneck ? <span className="status warning">{`Out of Flow • +${Math.max(0, elapsedDays - (expectedDays + groupGraceDays))}d`}</span> : null}
                {overdueSteps.length > 0 ? (
                  <span
                    className="overdue-group-chip"
                    role="button"
                    tabIndex={0}
                    aria-label={`${overdueSteps.length} overdue steps in ${group.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!openGroups.includes(group.id)) {
                        toggleGroup(group.id);
                      }
                      if (firstOverdueStep) {
                        setTimeout(() => scrollToStep(`${group.id}:${firstOverdueStep.id}`), 120);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      if (!openGroups.includes(group.id)) {
                        toggleGroup(group.id);
                      }
                      if (firstOverdueStep) {
                        setTimeout(() => scrollToStep(`${group.id}:${firstOverdueStep.id}`), 120);
                      }
                    }}
                  >
                    {`${overdueSteps.length} overdue`}
                  </span>
                ) : null}
              </span>
              <span className={`chevron ${openGroups.includes(group.id) ? "open" : ""}`}>▸</span>
            </button>
            <div className={`checklist-group-body ${openGroups.includes(group.id) ? "open" : ""}`}>
              <div className="checklist-steps">{group.steps.map((step) => renderStep(step, group.id))}</div>
            </div>
          </section>
          );
        })}
        {ungroupedState.length > 0 ? (
          <section className="checklist-group">
            <button
              type="button"
              className="checklist-group-header"
              onClick={() => toggleGroup("__ungrouped__")}
            >
              <span>Additional Flow Steps</span>
              <span className={`chevron ${openGroups.includes("__ungrouped__") ? "open" : ""}`}>▸</span>
            </button>
            <div className={`checklist-group-body ${openGroups.includes("__ungrouped__") ? "open" : ""}`}>
              <div className="checklist-steps">{ungroupedState.map((step) => renderStep(step, "__ungrouped__"))}</div>
            </div>
          </section>
        ) : null}
      </div>

      <div className="row matter-nav-row">
        {previousHref ? (
          <Link className="button btn-secondary-soft" href={previousHref}>
            Previous
          </Link>
        ) : (
          <span className="button btn-secondary-soft" style={{ opacity: 0.55, cursor: "not-allowed" }}>
            Previous
          </span>
        )}

        {nextHref ? (
          <Link className="button primary btn-primary-soft" href={nextHref}>
            Next
          </Link>
        ) : (
          <span className="button primary btn-primary-soft" style={{ opacity: 0.55, cursor: "not-allowed" }}>
            Next
          </span>
        )}
      </div>
    </div>
  );
}
