"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { computeMatterFlags, diffInDays } from "@/lib/matter-flags";
import { getGroupProgressStart, parseGroupProgress } from "@/lib/group-progress";
import { daysUntilDue, isDueSoon, isOverdue, overdueDays, resolveStepDueDate } from "@/lib/step-overdue";

type ChecklistStep = {
  id: string;
  label: string;
  completed: boolean;
  indentLevel: number;
  sortOrder: number;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  dueDaysOffset: number | null;
  dueAt: string | null;
};

type ChecklistGroup = {
  id: string;
  title: string;
  indentLevel: number;
  sortOrder: number;
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
  dueSoonHours: number;
  atRiskStageWindowDays?: number;
  bottleneckNoProgressDays?: number;
  noMovementDays?: number;
  bottleneckDays?: number;
  agingDays?: number;
  amountPaid: string;
  blurb: string;
  checklistGroups: ChecklistGroup[];
  ungroupedSteps: ChecklistStep[];
  highlightedStepIds?: string[];
  penaltyReason?: string | null;
  previousHref: string | null;
  nextHref: string | null;
};

// Fast rollback switch for the inline timeline UI only (no logic impact).
const ENABLE_INLINE_FLOW_TIMELINE = true;

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
    dueSoonHours,
    atRiskStageWindowDays = 2,
    bottleneckNoProgressDays = 2,
    noMovementDays = 7,
    bottleneckDays = 7,
    agingDays = 30,
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
  const [openCompletedPickerStepId, setOpenCompletedPickerStepId] = useState<string | null>(null);
  const [draftDueDates, setDraftDueDates] = useState<Record<string, string>>({});
  const [draftCompletedDates, setDraftCompletedDates] = useState<Record<string, string>>({});
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [openGroups, setOpenGroups] = useState<string[]>([
    ...checklistGroups.map((group) => group.id),
    "__ungrouped__"
  ]);
  const overdueStepRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const flowStripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setGroupsState(checklistGroups);
    setUngroupedState(ungroupedSteps);
    setOpenGroups([...checklistGroups.map((group) => group.id), "__ungrouped__"]);
  }, [checklistGroups, ungroupedSteps]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  }

  function formatDateForInput(value: string | null) {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function asFriendlyDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function localDateInputToIso(value: string) {
    const [yearRaw, monthRaw, dayRaw] = value.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null;
    }
    // Store local-noon timestamp so date-only inputs stay stable across timezones.
    const localNoon = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (Number.isNaN(localNoon.getTime())) {
      return null;
    }
    return localNoon.toISOString();
  }

  function completionBaseline(step: ChecklistStep) {
    const completedAtMs = step.completedAt ? new Date(step.completedAt).getTime() : Number.NaN;
    if (!Number.isNaN(completedAtMs)) return completedAtMs;
    const dueAtMs = step.dueAt ? new Date(step.dueAt).getTime() : Number.NaN;
    if (!Number.isNaN(dueAtMs)) return dueAtMs;
    return null;
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

    updateStep(stepId, (step) => ({ ...step, completed, completedAt: completed ? new Date().toISOString() : null }));

    const response = await fetch(`/api/matters/${matterId}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed, completedAt: completed ? new Date().toISOString() : null })
    });

    if (!response.ok) {
      setGroupsState(previousGroups);
      setUngroupedState(previousUngrouped);
    }

    setPendingIds((prev) => prev.filter((id) => id !== stepId));
  }

  async function onSetCompletedDate(stepId: string, completedAtDate: string | null) {
    const wasPending = pendingIds.includes(stepId);
    if (wasPending) return;

    setPendingIds((prev) => [...prev, stepId]);
    const previousGroups = groupsState;
    const previousUngrouped = ungroupedState;

    const completedAtIso = completedAtDate ? localDateInputToIso(completedAtDate) : null;
    if (completedAtDate && !completedAtIso) {
      setGroupsState(previousGroups);
      setUngroupedState(previousUngrouped);
      setPendingIds((prev) => prev.filter((id) => id !== stepId));
      return;
    }

    updateStep(stepId, (step) => ({
      ...step,
      completed: completedAtIso ? true : step.completed,
      completedAt: completedAtIso
    }));

    const response = await fetch(`/api/matters/${matterId}/steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: completedAtIso ? true : undefined, completedAt: completedAtIso })
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

    const dueAtIso = dueAt ? localDateInputToIso(dueAt) : null;
    if (dueAt && !dueAtIso) {
      setGroupsState(previousGroups);
      setUngroupedState(previousUngrouped);
      setPendingIds((prev) => prev.filter((id) => id !== stepId));
      return;
    }
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

  const getDefaultGroupStart = useCallback((groupId: string) => {
    const groupIndex = groupsState.findIndex((group) => group.id === groupId);
    if (groupIndex < 0) {
      return new Date(engagementDateValue || matterCreatedAtValue);
    }
    const currentStageFirstStep = [...groupsState[groupIndex].steps].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const firstStepCompletedAt = currentStageFirstStep ? completionBaseline(currentStageFirstStep) : null;
    const previousStage = [...groupsState]
      .filter((group) => group.sortOrder < groupsState[groupIndex].sortOrder)
      .sort((a, b) => b.sortOrder - a.sortOrder)[0];
    const previousStageLastStep = previousStage
      ? [...previousStage.steps]
          .filter((step) => step.completed)
          .sort((a, b) => b.sortOrder - a.sortOrder)[0]
      : null;
    const previousStageLastStepCompletedAt = previousStageLastStep
      ? completionBaseline(previousStageLastStep)
      : null;
    if (typeof firstStepCompletedAt === "number") {
      return new Date(Math.min(firstStepCompletedAt, Date.now()));
    }
    if (typeof previousStageLastStepCompletedAt === "number") {
      return new Date(Math.min(previousStageLastStepCompletedAt, Date.now()));
    }
    if (groupIndex === 0) {
      return new Date(engagementDateValue || matterCreatedAtValue);
    }

    const priorCompletionTimes = groupsState
      .slice(0, groupIndex)
      .flatMap((group) => group.steps)
      .filter((step) => step.completed)
      .map((step) => {
        const raw = step.completedAt;
        if (!raw) return null;
        const parsed = new Date(raw).getTime();
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((value): value is number => typeof value === "number");

    if (priorCompletionTimes.length === 0) {
      const engagementOrCreated = new Date(engagementDateValue || matterCreatedAtValue);
      const nowMs = Date.now();
      const currentGroupCompletedTimes = groupsState[groupIndex].steps
        .filter((step) => step.completed && step.completedAt)
        .map((step) => {
          const parsed = new Date(step.completedAt as string).getTime();
          return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      if (currentGroupCompletedTimes.length > 0) {
        return new Date(Math.min(currentGroupCompletedTimes[0], nowMs));
      }
      const currentGroupFirstStepCreated = groupsState[groupIndex].steps
        .map((step) => {
          const raw = step.createdAt;
          if (!raw) return null;
          const parsed = new Date(raw).getTime();
          return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b)[0];
      if (currentGroupFirstStepCreated) {
        return new Date(Math.max(engagementOrCreated.getTime(), currentGroupFirstStepCreated));
      }
      return engagementOrCreated;
    }

    return new Date(Math.max(...priorCompletionTimes));
  }, [engagementDateValue, groupsState, matterCreatedAtValue]);

  const getAnchoredGroupStart = useCallback((groupId: string) => {
    const groupIndex = groupsState.findIndex((group) => group.id === groupId);
    if (groupIndex < 0) return null;
    const currentStageFirstStep = [...groupsState[groupIndex].steps].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const firstStepCompletedAt = currentStageFirstStep ? completionBaseline(currentStageFirstStep) : null;
    const previousStage = [...groupsState]
      .filter((group) => group.sortOrder < groupsState[groupIndex].sortOrder)
      .sort((a, b) => b.sortOrder - a.sortOrder)[0];
    const previousStageLastStep = previousStage
      ? [...previousStage.steps]
          .filter((step) => step.completed)
          .sort((a, b) => b.sortOrder - a.sortOrder)[0]
      : null;
    const previousStageLastStepCompletedAt = previousStageLastStep
      ? completionBaseline(previousStageLastStep)
      : null;
    if (typeof firstStepCompletedAt === "number") {
      return new Date(Math.min(firstStepCompletedAt, Date.now()));
    }
    if (typeof previousStageLastStepCompletedAt === "number") {
      return new Date(Math.min(previousStageLastStepCompletedAt, Date.now()));
    }
    return null;
  }, [groupsState]);

  const getGroupUpperBound = useCallback((groupId: string) => {
    const nowMs = Date.now();
    const group = groupsState.find((item) => item.id === groupId);
    if (!group) return new Date();
    const currentStageFirstStep = [...group.steps].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const firstStepCompletedAt = currentStageFirstStep ? completionBaseline(currentStageFirstStep) : null;
    if (typeof firstStepCompletedAt === "number") {
      return new Date(Math.min(firstStepCompletedAt, nowMs));
    }
    const completedTimes = group.steps
      .filter((step) => step.completed && step.completedAt)
      .map((step) => {
        const parsed = new Date(step.completedAt as string).getTime();
        return Number.isNaN(parsed) ? null : parsed;
      })
      .filter((value): value is number => typeof value === "number")
      .sort((a, b) => a - b);
    if (completedTimes.length > 0) {
      return new Date(Math.min(completedTimes[0], nowMs));
    }
    return new Date();
  }, [groupsState]);

  function formatElapsedPill(days: number) {
    if (days <= 0) return "Started today";
    if (days === 1) return "1 day in stage";
    return `${days} days in stage`;
  }

  const getOverdueState = useCallback((step: ChecklistStep) => {
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
  }, [dueContext]);

  const getDueSoonState = useCallback((step: ChecklistStep, now = new Date()) => {
    if (step.completed) {
      return { dueSoon: false, daysUntilDue: null as number | null, dueDate: null as Date | null };
    }
    const dueDate = resolveStepDueDate(
      {
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset
      },
      dueContext
    );
    if (!dueDate) {
      return { dueSoon: false, daysUntilDue: null as number | null, dueDate: null as Date | null };
    }
    const dueSoon = isDueSoon(
      {
        completed: step.completed,
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset
      },
      dueContext,
      dueSoonHours,
      now
    );
    const remainingDays = dueSoon
      ? daysUntilDue(
          {
            dueAt: step.dueAt,
            dueDaysOffset: step.dueDaysOffset
          },
          dueContext,
          now
        )
      : null;
    return { dueSoon, daysUntilDue: remainingDays, dueDate };
  }, [dueContext, dueSoonHours]);

  const flowState = useMemo(() => {
    const now = new Date(nowTick);
    const allSteps = [...groupsState.flatMap((group) => group.steps), ...ungroupedState];
    const openSteps = allSteps.filter((step) => !step.completed);
    const overdueSteps = openSteps.filter((step) =>
      isOverdue(
        {
          completed: step.completed,
          dueAt: step.dueAt,
          dueDaysOffset: step.dueDaysOffset
        },
        dueContext,
        now
      )
    );
    const dueSoonSteps = openSteps.filter((step) =>
      isDueSoon(
        {
          completed: step.completed,
          dueAt: step.dueAt,
          dueDaysOffset: step.dueDaysOffset
        },
        dueContext,
        dueSoonHours,
        now
      )
    );

    const currentGroup = groupsState.find((group) => group.steps.some((step) => !step.completed)) ?? null;
    let currentGroupElapsedDays: number | null = null;
    let currentGroupExpectedDays: number | null = null;
    let isCurrentGroupBottleneck = false;
    let isCurrentGroupNearLimit = false;
    if (currentGroup) {
      const derivedExpectedDays =
        currentGroup.steps
          .map((step) => step.dueDaysOffset)
          .filter((offset): offset is number => typeof offset === "number" && offset >= 0)
          .reduce((max, offset) => Math.max(max, offset), 0) || null;
      const expectedDays = currentGroup.expectedDurationDays ?? derivedExpectedDays ?? defaultGroupExpectedDays;
      const anchoredStart = getAnchoredGroupStart(currentGroup.id);
      const groupStart =
        anchoredStart ??
        getGroupProgressStart(
          parsedGroupProgress,
          currentGroup.id,
          getDefaultGroupStart(currentGroup.id),
          getGroupUpperBound(currentGroup.id)
        );
      const elapsedDays = diffInDays(now, groupStart);
      currentGroupElapsedDays = elapsedDays;
      currentGroupExpectedDays = expectedDays;
      isCurrentGroupBottleneck = elapsedDays > expectedDays + groupGraceDays;
      const remainingToLimit = expectedDays + groupGraceDays - elapsedDays;
      isCurrentGroupNearLimit =
        atRiskStageWindowDays > 0 &&
        !isCurrentGroupBottleneck &&
        remainingToLimit >= 0 &&
        remainingToLimit <= atRiskStageWindowDays;
    }

    const flags = computeMatterFlags(
      {
        createdAt: new Date(matterCreatedAtValue),
        updatedAt: new Date(now),
        engagementDate: engagementDateValue,
        closedAt: null,
        groupProgress,
        groups: groupsState.map((group) => ({
          id: group.id,
          title: group.title,
          sortOrder: group.sortOrder,
          expectedDurationDays: group.expectedDurationDays
        })),
        steps: [
          ...groupsState.flatMap((group) =>
            group.steps.map((step) => ({
              ...step,
              groupId: group.id
            }))
          ),
          ...ungroupedState.map((step) => ({
            ...step,
            groupId: null as string | null
          }))
        ].map((step) => ({
          id: step.id,
          label: step.label,
          completed: step.completed,
          completedAt: step.completedAt ? new Date(step.completedAt) : null,
          dueAt: step.dueAt ? new Date(step.dueAt) : null,
          dueDaysOffset: step.dueDaysOffset,
          sortOrder: step.sortOrder,
          groupId: step.groupId,
          createdAt: step.createdAt ? new Date(step.createdAt) : new Date(matterCreatedAtValue),
          updatedAt: step.updatedAt ? new Date(step.updatedAt) : new Date(now)
        }))
      },
      {
        bottleneckNoProgressDays,
        noMovementDays,
        bottleneckDays,
        defaultGroupExpectedDays,
        groupGraceDays,
        groupTimingEnabled: true,
        agingDays,
        dueSoonHours,
        atRiskStageWindowDays,
        penaltyBoxOpenDays: penaltyThreshold,
        penaltyIncludeOverdue: true,
        penaltyIncludeAging: true
      },
      now
    );
 
    const statusLabel =
      flags.statusLabel === "Penalty Box"
        ? "Flow Breakdown"
        : flags.statusLabel === "Bottlenecked"
          ? "Out of Flow"
          : flags.statusLabel === "Needs Attention"
            ? "At Flow Risk"
            : "In Flow";
    const statusClass = statusLabel === "In Flow" ? "success" : statusLabel === "At Flow Risk" ? "warning" : "danger";
    const reason = flags.statusLabel === "On Track" ? "This matter is currently In Flow." : flags.reason;

    return {
      overdueStepCount: overdueSteps.length,
      dueSoonStepCount: dueSoonSteps.length,
      currentGroupId: currentGroup?.id ?? null,
      currentGroupElapsedDays,
      currentGroupExpectedDays,
      isCurrentGroupBottleneck,
      statusLabel,
      statusClass,
      reason
    };
  }, [
    groupsState,
    ungroupedState,
    dueContext,
    nowTick,
    dueSoonHours,
    atRiskStageWindowDays,
    bottleneckNoProgressDays,
    noMovementDays,
    bottleneckDays,
    agingDays,
    parsedGroupProgress,
    getAnchoredGroupStart,
    getDefaultGroupStart,
    getGroupUpperBound,
    defaultGroupExpectedDays,
    groupGraceDays,
    groupProgress,
    matterCreatedAtValue,
    engagementDateValue,
    penaltyThreshold
  ]);

  function scrollToStep(stepId: string) {
    const el = overdueStepRefs.current[stepId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderStep(step: ChecklistStep, groupId?: string) {
    const isPending = pendingIds.includes(step.id);
    const hasCustomDueAt = Boolean(step.dueAt);
    const isDatePickerOpen = openDuePickerStepId === step.id;
    const isCompletedDatePickerOpen = openCompletedPickerStepId === step.id;
    const { overdue, daysLate, dueDate } = getOverdueState(step);
    const { dueSoon, daysUntilDue } = getDueSoonState(step);
    const rowIsOverdue = overdue;
    const rowIsAtRisk = !overdue && dueSoon;

    return (
      <div
        className={`checklist-step ${rowIsOverdue ? "penalty-highlight overdue-step" : rowIsAtRisk ? "at-risk-step" : ""}`}
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
          {step.completedAt ? (
            <span className="step-meta">{`Completed ${asFriendlyDate(step.completedAt)}`}</span>
          ) : null}
        </span>
        {overdue ? (
          <span className="status overdue step-overdue-badge" aria-label={`Overdue by ${daysLate} days`}>
            {`Overdue • ${daysLate}d`}
          </span>
        ) : rowIsAtRisk ? (
          <span className="status warning step-risk-badge" aria-label="At Flow Risk">
            {`At Flow Risk${daysUntilDue !== null ? ` • ${daysUntilDue}d` : ""}`}
          </span>
        ) : null}
        <button
          type="button"
          className="button btn-secondary-soft"
          aria-label="Set due date"
          title="Set due date"
          disabled={isPending}
          onClick={() => {
            setOpenCompletedPickerStepId(null);
            setDraftDueDates((prev) => ({ ...prev, [step.id]: formatDateForInput(step.dueAt) }));
            setOpenDuePickerStepId((prev) => (prev === step.id ? null : step.id));
          }}
        >
          Due date
        </button>
        {step.completed ? (
          <button
            type="button"
            className="button btn-secondary-soft"
            aria-label="Set completed date"
            title="Set completed date"
            disabled={isPending}
            onClick={() => {
              setOpenDuePickerStepId(null);
              setDraftCompletedDates((prev) => ({ ...prev, [step.id]: formatDateForInput(step.completedAt ?? null) }));
              setOpenCompletedPickerStepId((prev) => (prev === step.id ? null : step.id));
            }}
          >
            Completed date
          </button>
        ) : null}
        {isDatePickerOpen ? (
          <span className="row due-edit-row">
            <span className="meta">Due date:</span>
            <input
              type="date"
              className="input due-date-input"
              value={draftDueDates[step.id] ?? formatDateForInput(step.dueAt)}
              disabled={isPending}
              onChange={(event) => {
                const value = event.target.value;
                setDraftDueDates((prev) => ({ ...prev, [step.id]: value }));
              }}
            />
            <button
              type="button"
              className="button btn-secondary-soft"
              disabled={isPending}
              onClick={() => {
                setDraftDueDates((prev) => ({ ...prev, [step.id]: "" }));
                onSetDueDate(step.id, null);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="button"
              disabled={isPending}
              onClick={() => {
                const value = draftDueDates[step.id] ?? formatDateForInput(step.dueAt);
                onSetDueDate(step.id, value || null);
              }}
            >
              Set
            </button>
          </span>
        ) : null}
        {isCompletedDatePickerOpen && step.completed ? (
          <span className="row due-edit-row">
            <span className="meta">Completed date:</span>
            <input
              type="date"
              className="input due-date-input"
              value={draftCompletedDates[step.id] ?? formatDateForInput(step.completedAt ?? null)}
              disabled={isPending}
              onChange={(event) => {
                const value = event.target.value;
                setDraftCompletedDates((prev) => ({ ...prev, [step.id]: value }));
              }}
            />
            <button
              type="button"
              className="button btn-secondary-soft"
              disabled={isPending}
              onClick={() => {
                setDraftCompletedDates((prev) => ({ ...prev, [step.id]: "" }));
                onSetCompletedDate(step.id, null);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="button"
              disabled={isPending}
              onClick={() => {
                const value = draftCompletedDates[step.id] ?? formatDateForInput(step.completedAt ?? null);
                onSetCompletedDate(step.id, value || null);
              }}
            >
              Set
            </button>
          </span>
        ) : null}
      </div>
    );
  }

  const timelineStages = useMemo(() => {
    const now = new Date(nowTick);
    const currentGroup = groupsState.find((group) => group.steps.some((step) => !step.completed)) ?? null;
    const currentSortOrder = currentGroup?.sortOrder ?? Number.MAX_SAFE_INTEGER;

    return groupsState.map((group) => {
      const totalSteps = group.steps.length;
      const completedSteps = group.steps.filter((step) => step.completed).length;
      const allCompleted = totalSteps > 0 && completedSteps === totalSteps;
      const isCurrent = currentGroupId === group.id;
      const isUpcoming = !allCompleted && !isCurrent && group.sortOrder > currentSortOrder;

      const derivedExpectedDays =
        group.steps
          .map((step) => step.dueDaysOffset)
          .filter((offset): offset is number => typeof offset === "number" && offset >= 0)
          .reduce((max, offset) => Math.max(max, offset), 0) || null;
      const expectedDays = group.expectedDurationDays ?? derivedExpectedDays ?? defaultGroupExpectedDays;

      const anchoredStart = getAnchoredGroupStart(group.id);
      const groupStart =
        anchoredStart ??
        getGroupProgressStart(
          parsedGroupProgress,
          group.id,
          getDefaultGroupStart(group.id),
          getGroupUpperBound(group.id)
        );
      const elapsedDays = diffInDays(now, groupStart);

      const overdueCount = group.steps.filter((step) => getOverdueState(step).overdue).length;
      const dueSoonCount = group.steps.filter((step) => !getOverdueState(step).overdue && getDueSoonState(step, now).dueSoon).length;
      const isBottleneck = isCurrent && elapsedDays > expectedDays + groupGraceDays;
      const remainingToLimit = expectedDays + groupGraceDays - elapsedDays;
      const isNearLimit =
        isCurrent &&
        !isBottleneck &&
        atRiskStageWindowDays > 0 &&
        remainingToLimit >= 0 &&
        remainingToLimit <= atRiskStageWindowDays;

      let tone: "in" | "risk" | "out" | "upcoming" | "done" = "upcoming";
      let statusText = "Not entered yet";

      if (allCompleted) {
        tone = "done";
        statusText = "Completed";
      } else if (isUpcoming) {
        tone = "upcoming";
        statusText = "Not entered yet";
      } else if (isCurrent && flowState.statusLabel === "Out of Flow") {
        tone = "out";
        statusText = overdueCount > 0 ? `${overdueCount} overdue` : "Out of Flow";
      } else if (isCurrent && flowState.statusLabel === "At Flow Risk") {
        tone = "risk";
        statusText = dueSoonCount > 0 ? `${dueSoonCount} due soon` : "At Flow Risk";
      } else if (isCurrent && flowState.statusLabel === "In Flow") {
        tone = "in";
        statusText = "In Flow";
      } else if (overdueCount > 0 || isBottleneck) {
        tone = "out";
        statusText = overdueCount > 0 ? `${overdueCount} overdue` : "Out of Flow";
      } else if (dueSoonCount > 0 || isNearLimit) {
        tone = "risk";
        statusText = dueSoonCount > 0 ? `${dueSoonCount} due soon` : "At Flow Risk";
      } else if (isCurrent) {
        tone = "in";
        statusText = "In Flow";
      }

      let durationText = `Expected: ${expectedDays}d`;
      if (isCurrent || allCompleted) {
        durationText = formatElapsedPill(elapsedDays);
      }

      const maxOverdueDays = group.steps.reduce((max, step) => {
        const state = getOverdueState(step);
        return state.overdue ? Math.max(max, state.daysLate) : max;
      }, 0);
      const limitDays = expectedDays + groupGraceDays;
      const overByDays = Math.max(0, elapsedDays - limitDays);
      const daysToLimit = Math.max(0, limitDays - elapsedDays);

      return {
        id: group.id,
        title: group.title,
        isCurrent,
        tone,
        statusText,
        durationText,
        completedSteps,
        totalSteps,
        expectedDays,
        elapsedDays,
        dueSoonCount,
        overdueCount,
        maxOverdueDays,
        overByDays,
        daysToLimit
      };
    });
  }, [
    groupsState,
    currentGroupId,
    nowTick,
    defaultGroupExpectedDays,
    parsedGroupProgress,
    getAnchoredGroupStart,
    getDefaultGroupStart,
    getGroupUpperBound,
    getOverdueState,
    getDueSoonState,
    groupGraceDays,
    atRiskStageWindowDays,
    flowState.statusLabel
  ]);

  const activeTimelineStage = useMemo(() => {
    const current = timelineStages.find((stage) => stage.isCurrent);
    if (current) return current;
    const firstPending = timelineStages.find((stage) => stage.tone !== "done");
    if (firstPending) return firstPending;
    return timelineStages[timelineStages.length - 1] ?? null;
  }, [timelineStages]);

  const shouldScrollFlowStrip = timelineStages.length > 5;
  const stageWeights = useMemo(() => {
    if (!timelineStages.length) return [1];
    return timelineStages.map((stage) => {
      const base = Number.isFinite(stage.expectedDays) && stage.expectedDays > 0 ? stage.expectedDays : 1;
      // Keep very short stages visible as a real segment.
      return Math.max(1, base);
    });
  }, [timelineStages]);
  const stageGridColumns = useMemo(() => stageWeights.map((weight) => `${weight}fr`).join(" "), [stageWeights]);
  const stripWidth = useMemo(() => {
    if (!shouldScrollFlowStrip) return 0;
    const totalWeight = stageWeights.reduce((sum, weight) => sum + weight, 0);
    return Math.max(980, totalWeight * 42);
  }, [shouldScrollFlowStrip, stageWeights]);
  const firstTimelineStage = timelineStages[0] ?? null;

  function flowSegmentTone(tone: "in" | "risk" | "out" | "upcoming" | "done") {
    if (tone === "done") return "in";
    if (tone === "upcoming") return "upcoming";
    return tone;
  }

  function iconForTone(tone: "in" | "risk" | "out" | "upcoming" | "done") {
    if (tone === "out") return "!";
    if (tone === "risk") return "△";
    if (tone === "in" || tone === "done") return "✓";
    return "•";
  }

  function scrollFlowStrip(direction: "left" | "right") {
    const node = flowStripRef.current;
    if (!node) return;
    node.scrollBy({ left: direction === "left" ? -320 : 320, behavior: "smooth" });
  }

  const healthPanelStatus = useMemo(() => {
    const tone = flowState.statusClass === "danger" ? "out" : flowState.statusClass === "warning" ? "risk" : "in";
    const title =
      flowState.statusLabel === "Out of Flow"
        ? "OUT OF FLOW"
        : flowState.statusLabel === "At Flow Risk"
          ? "AT FLOW RISK"
          : "IN FLOW";

    let detail = "On track";
    if (flowState.statusLabel === "Out of Flow") {
      if (activeTimelineStage && activeTimelineStage.maxOverdueDays > 0) {
        detail = `+${activeTimelineStage.maxOverdueDays} days overdue`;
      } else if (activeTimelineStage && activeTimelineStage.overByDays > 0) {
        detail = `+${activeTimelineStage.overByDays} days over limit`;
      } else {
        detail = "Attention needed";
      }
    } else if (flowState.statusLabel === "At Flow Risk") {
      if (activeTimelineStage && activeTimelineStage.dueSoonCount > 0) {
        detail = `${activeTimelineStage.dueSoonCount} due soon`;
      } else if (activeTimelineStage) {
        detail = `${activeTimelineStage.daysToLimit} day${activeTimelineStage.daysToLimit === 1 ? "" : "s"} remaining`;
      } else {
        detail = "Due soon";
      }
    }

    return { tone, title, detail };
  }, [flowState.statusClass, flowState.statusLabel, activeTimelineStage]);

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
          <div className={`home-health-badge ${flowState.statusClass}`}>{flowState.statusLabel}</div>
        </div>
        <p className="meta" style={{ margin: "0 0 10px" }}>{flowState.reason}</p>
        <p className="matter-blurb">{blurb}</p>
      </section>
      {ENABLE_INLINE_FLOW_TIMELINE ? (
        <section className="glass-card flow-health-panel">
          <div className="flow-health-shell">
            <div className="flow-health-head">
              <div className="flow-health-title-wrap">
                <button
                  type="button"
                  className="flow-health-chevron"
                  onClick={() => scrollFlowStrip("left")}
                  aria-label="Scroll flow stages left"
                  disabled={!shouldScrollFlowStrip}
                >
                  ‹‹
                </button>
                <h3 style={{ margin: 0 }}>Flow Health Bar</h3>
              </div>
              <button
                type="button"
                className="flow-health-chevron"
                onClick={() => scrollFlowStrip("right")}
                aria-label="Scroll flow stages right"
                disabled={!shouldScrollFlowStrip}
              >
                ››
              </button>
            </div>

            <div className={`flow-health-track-scroller ${shouldScrollFlowStrip ? "" : "no-scroll"}`} ref={flowStripRef}>
              <div
                className="flow-health-track"
                style={
                  shouldScrollFlowStrip
                    ? { minWidth: `${stripWidth}px`, gridTemplateColumns: stageGridColumns }
                    : { width: "100%", minWidth: 0, gridTemplateColumns: stageGridColumns }
                }
              >
                {timelineStages.map((stage, index) => {
                  const segmentTone = flowSegmentTone(stage.tone);
                  return (
                    <div key={`${stage.id}-node`} className="flow-health-stage-cell">
                      <span className={`flow-health-segment ${segmentTone}`} aria-hidden="true" />
                      <span className={`flow-health-node ${flowSegmentTone(stage.tone)}`}>{iconForTone(stage.tone)}</span>
                      <span className="flow-health-node-label">{stage.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {firstTimelineStage ? (
              <div className="flow-health-first-stage" aria-label={`First flow stage ${firstTimelineStage.title}`}>
                <span className="flow-health-first-check" aria-hidden="true">✓</span>
                <span>{firstTimelineStage.title}</span>
              </div>
            ) : null}

            <div className="flow-health-divider" />

            <div className="flow-health-summary-row">
              <article className={`flow-health-summary-card ${activeTimelineStage?.tone ?? "upcoming"}`}>
                <div className="flow-health-summary-line">{`Step Progress  ${activeTimelineStage ? `${activeTimelineStage.completedSteps} / ${activeTimelineStage.totalSteps}` : "—"} steps`}</div>
                <div className="flow-health-summary-sub">{`Expected: ${activeTimelineStage ? activeTimelineStage.expectedDays : defaultGroupExpectedDays} days`}</div>
              </article>
              <article className={`flow-health-summary-card ${healthPanelStatus.tone}`}>
                <div className="flow-health-summary-line alert">
                  <span className={`flow-health-dot ${healthPanelStatus.tone}`} aria-hidden="true" />
                  <span>{healthPanelStatus.title}</span>
                  <span className="flow-health-alert-icon" aria-hidden="true">!</span>
                  <span>{healthPanelStatus.detail}</span>
                </div>
                <div className="flow-health-summary-sub">{`Expected: ${activeTimelineStage ? activeTimelineStage.expectedDays : defaultGroupExpectedDays} days`}</div>
              </article>
            </div>
          </div>
        </section>
      ) : null}
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
          const anchoredStart = getAnchoredGroupStart(group.id);
          const groupStart =
            anchoredStart ??
            getGroupProgressStart(
              parsedGroupProgress,
              group.id,
              getDefaultGroupStart(group.id),
              getGroupUpperBound(group.id)
            );
          const elapsedDays = diffInDays(new Date(nowTick), groupStart);
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
                {groupIsCurrent ? <span className="pill">{formatElapsedPill(elapsedDays)}</span> : null}
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
