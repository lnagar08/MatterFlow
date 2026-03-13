import { getGroupProgressStart, parseGroupProgress } from "@/lib/group-progress";
import { isDueSoon as isStepDueSoon, isOverdue, resolveStepDueDate } from "@/lib/step-overdue";

const DAY_MS = 1000 * 60 * 60 * 24;

type FlagSettings = {
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

type FlagStep = {
  id: string;
  label?: string;
  completed?: boolean;
  isCompleted?: boolean;
  completedAt?: Date | null;
  completedOn?: Date | null;
  dueAt?: Date | null;
  dueDate?: Date | null;
  dueDaysOffset?: number | null;
  sortOrder: number;
  groupId?: string | null;
  updatedAt?: Date;
  createdAt?: Date;
};

type FlagGroup = {
  id: string;
  title?: string;
  sortOrder: number;
  expectedDurationDays?: number | null;
};

type MatterInput = {
  createdAt: Date;
  updatedAt: Date;
  engagementDate?: Date | string | null;
  closedAt?: Date | null;
  isClosed?: boolean;
  status?: string | null;
  groupProgress?: unknown;
  steps: FlagStep[];
  groups: FlagGroup[];
};

export type TopIssue = {
  stepName: string;
  groupName: string | null;
  dueDate: string | null;
  overdueDays: number;
  type: "overdue" | "dueSoon" | "bottleneck" | "aging";
};

export type MatterFlags = {
  isOverdue: boolean;
  isDueSoon: boolean;
  isBottlenecked: boolean;
  isAging: boolean;
  isAtRisk: boolean;
  needsAttention: boolean;
  isPenaltyBox: boolean;
  overdueStepsCount: number;
  dueSoonStepsCount: number;
  daysSinceProgress: number;
  daysOpen: number;
  reason: string;
  statusLabel: "On Track" | "Needs Attention" | "Bottlenecked" | "Penalty Box";
  bottleneckReason: string | null;
  bottleneckMeta: {
    groupName: string | null;
    expectedDays: number | null;
    elapsedDays: number | null;
    graceDays: number;
  };
  penaltyReasons: string[];
  topIssues: TopIssue[];
};

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function completionBaseline(step: MatterInput["steps"][number]) {
  return (
    toValidDate(step.completedAt ?? step.completedOn)?.getTime() ??
    toValidDate(step.dueAt)?.getTime() ??
    null
  );
}

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function diffInDays(a: Date, b: Date) {
  return Math.floor((startOfDayLocal(a).getTime() - startOfDayLocal(b).getTime()) / DAY_MS);
}

export function computeMatterFlags(matter: MatterInput, settings: FlagSettings, now = new Date()): MatterFlags {
  const openSteps = matter.steps.filter((step) => !(step.completed ?? step.isCompleted ?? false));
  const dueContext = {
    engagementDate: matter.engagementDate ?? null,
    createdAt: matter.createdAt
  };

  const overdueSteps = openSteps.filter((step) => isOverdue(step, dueContext, now));
  const dueSoonSteps = openSteps.filter((step) => isStepDueSoon(step, dueContext, settings.dueSoonHours, now));
  const nowMs = now.getTime();

  const completedTimes = matter.steps
    .filter((step) => (step.completed ?? step.isCompleted ?? false) && (step.completedAt ?? step.completedOn))
    .map((step) => toValidDate(step.completedAt ?? step.completedOn)?.getTime())
    .filter((value): value is number => typeof value === "number");
  const lastProgressMs =
    completedTimes.length > 0
      ? Math.max(...completedTimes)
      : new Date(matter.updatedAt ?? matter.createdAt).getTime();
  const daysSinceProgress = Math.floor((nowMs - lastProgressMs) / DAY_MS);

  const groupsById = new Map(matter.groups.map((group) => [group.id, group]));
  const groupOrderById = new Map(matter.groups.map((group) => [group.id, group.sortOrder]));
  const groupedOpenSteps = openSteps
    .filter((step) => step.groupId && groupOrderById.has(step.groupId))
    .sort((a, b) => {
      const aOrder = groupOrderById.get(a.groupId as string) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = groupOrderById.get(b.groupId as string) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.sortOrder - b.sortOrder;
    });
  const currentOpenStep = groupedOpenSteps[0];
  const groupProgress = parseGroupProgress(matter.groupProgress);

  let groupDurationExceeded = false;
  let stageNearLimit = false;
  let bottleneckReason: string | null = null;
  let bottleneckMeta: MatterFlags["bottleneckMeta"] = {
    groupName: null,
    expectedDays: null,
    elapsedDays: null,
    graceDays: settings.groupGraceDays
  };

  if ((settings.groupTimingEnabled ?? true) && currentOpenStep?.groupId) {
    const currentGroup = groupsById.get(currentOpenStep.groupId);
    const derivedExpectedDays =
      matter.steps
        .filter((step) => step.groupId === currentOpenStep.groupId)
        .map((step) => step.dueDaysOffset)
        .filter((offset): offset is number => typeof offset === "number" && offset >= 0)
        .reduce((max, offset) => Math.max(max, offset), 0) || null;
    const expected = currentGroup?.expectedDurationDays ?? derivedExpectedDays ?? settings.defaultGroupExpectedDays;
    if (expected && expected > 0) {
      const currentStageFirstStep = matter.steps
        .filter((step) => step.groupId === currentOpenStep.groupId)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const firstStepCompletedAtMs = currentStageFirstStep ? completionBaseline(currentStageFirstStep) : null;
      const previousStage = [...matter.groups]
        .filter((group) => group.sortOrder < (currentGroup?.sortOrder ?? 0))
        .sort((a, b) => b.sortOrder - a.sortOrder)[0];
      const previousStageLastCompletedStep = previousStage
        ? matter.steps
            .filter(
              (step) =>
                step.groupId === previousStage.id &&
                (step.completed ?? step.isCompleted ?? false)
            )
            .sort((a, b) => b.sortOrder - a.sortOrder)[0]
        : null;
      const previousStageLastStepCompletedAtMs = previousStageLastCompletedStep
        ? completionBaseline(previousStageLastCompletedStep)
        : null;
      const previousGroups = matter.groups
        .filter((group) => group.sortOrder < (currentGroup?.sortOrder ?? 0))
        .map((group) => group.id);
      const previousGroupCompletions = matter.steps
        .filter(
          (step) =>
            step.groupId &&
            previousGroups.includes(step.groupId) &&
            (step.completed ?? step.isCompleted ?? false)
        )
        .map((step) => {
          const date = toValidDate(step.completedAt ?? step.completedOn);
          return date?.getTime();
        })
        .filter((value): value is number => typeof value === "number");

      const anchoredStart =
        typeof firstStepCompletedAtMs === "number"
          ? new Date(Math.min(firstStepCompletedAtMs, nowMs))
          : typeof previousStageLastStepCompletedAtMs === "number"
            ? new Date(Math.min(previousStageLastStepCompletedAtMs, nowMs))
            : null;
      const defaultStart = anchoredStart
        ? anchoredStart
        : previousGroupCompletions.length > 0
          ? new Date(Math.max(...previousGroupCompletions))
          : (() => {
              const engagementOrCreated = new Date(matter.engagementDate ?? matter.createdAt);
              const currentGroupCompletedTimes = matter.steps
                .filter(
                  (step) =>
                    step.groupId === currentOpenStep.groupId &&
                    (step.completed ?? step.isCompleted ?? false)
                )
                .map((step) => toValidDate(step.completedAt ?? step.completedOn)?.getTime())
                .filter((value): value is number => typeof value === "number")
                .sort((a, b) => a - b);
              if (currentGroupCompletedTimes.length > 0) {
                return new Date(Math.min(currentGroupCompletedTimes[0], nowMs));
              }
              const currentGroupFirstStepCreated = matter.steps
                .filter((step) => step.groupId === currentOpenStep.groupId)
                .map((step) => toValidDate(step.createdAt)?.getTime())
                .filter((value): value is number => typeof value === "number")
                .sort((a, b) => a - b)[0];
              if (currentGroupFirstStepCreated) {
                return new Date(Math.max(engagementOrCreated.getTime(), currentGroupFirstStepCreated));
              }
              return engagementOrCreated;
            })();

      const currentGroupCompletedTimes = matter.steps
        .filter(
          (step) =>
            step.groupId === currentOpenStep.groupId &&
            (step.completed ?? step.isCompleted ?? false)
        )
        .map((step) => toValidDate(step.completedAt ?? step.completedOn)?.getTime())
        .filter((value): value is number => typeof value === "number")
        .sort((a, b) => a - b);
      const upperBound =
        typeof firstStepCompletedAtMs === "number"
          ? new Date(Math.min(firstStepCompletedAtMs, nowMs))
          : currentGroupCompletedTimes.length > 0
          ? new Date(Math.min(currentGroupCompletedTimes[0], nowMs))
          : now;

      const progressStart =
        anchoredStart ??
        getGroupProgressStart(groupProgress, currentOpenStep.groupId, defaultStart, upperBound);
      const groupDays = diffInDays(now, progressStart);
      const graceDays = Math.max(0, settings.groupGraceDays ?? 2);
      if (groupDays > expected + graceDays) {
        const limit = expected + graceDays;
        const overBy = groupDays - limit;
        groupDurationExceeded = true;
        bottleneckReason = `Current stage ${groupDays}d elapsed (target ${expected}d + ${graceDays}d grace; ${overBy}d over limit)`;
        bottleneckMeta = {
          groupName: currentGroup?.title ?? `Group ${currentGroup?.sortOrder ?? ""}`.trim(),
          expectedDays: expected,
          elapsedDays: groupDays,
          graceDays
        };
      } else {
        const windowDays = Math.max(0, settings.atRiskStageWindowDays ?? 2);
        const limit = expected + graceDays;
        const daysToLimit = limit - groupDays;
        if (windowDays > 0 && daysToLimit >= 0 && daysToLimit <= windowDays) {
          stageNearLimit = true;
          bottleneckMeta = {
            groupName: currentGroup?.title ?? `Group ${currentGroup?.sortOrder ?? ""}`.trim(),
            expectedDays: expected,
            elapsedDays: groupDays,
            graceDays
          };
        }
      }
    }
  }

  const hasOverdue = overdueSteps.length > 0;
  const isDueSoon = dueSoonSteps.length > 0;
  const noProgressThreshold = Math.max(1, settings.bottleneckDays ?? settings.noMovementDays ?? 7);
  const noProgressExceeded = daysSinceProgress >= noProgressThreshold;
  if (noProgressExceeded && !bottleneckReason) {
    bottleneckReason = `No progress in ${daysSinceProgress} days`;
  }
  const isBottlenecked = groupDurationExceeded || noProgressExceeded;

  const isClosed = Boolean(matter.closedAt || matter.isClosed || (matter.status ?? "").toLowerCase() === "closed");
  const engagementDate = toValidDate(matter.engagementDate);
  if (!engagementDate && process.env.NODE_ENV === "development") {
    console.warn("[matter-flags] Invalid or missing engagementDate; excluding from Penalty Box", {
      createdAt: matter.createdAt?.toISOString?.(),
      engagementDateRaw: matter.engagementDate
    });
  }
  const daysOpen = engagementDate ? diffInDays(now, engagementDate) : 0;
  const isPenaltyBox = !isClosed && Boolean(engagementDate) && daysOpen > settings.penaltyBoxOpenDays;
  const isAging = !isClosed && Boolean(engagementDate) && daysOpen > settings.agingDays;

  // Home classification is exclusive by precedence:
  // Penalty Box > Bottlenecked/Overdue > At Risk > On Track.
  // At Risk is only used when a matter is approaching risk but not already in a higher-severity bucket.
  const isAtRisk = !isPenaltyBox && !hasOverdue && !isBottlenecked && (isDueSoon || stageNearLimit);
  const needsAttention = hasOverdue || isBottlenecked || isDueSoon || stageNearLimit;

  const penaltyReasons: string[] = [];
  if (isPenaltyBox) {
    penaltyReasons.push(`Not closed ${daysOpen} days after engagement (threshold: ${settings.penaltyBoxOpenDays}d)`);
    if ((settings.penaltyIncludeOverdue ?? true) && hasOverdue) {
      penaltyReasons.push(`${overdueSteps.length} overdue ${overdueSteps.length === 1 ? "step" : "steps"}`);
    }
    if ((settings.penaltyIncludeAging ?? true) && isAging) {
      penaltyReasons.push(`Open ${daysOpen} days (aging threshold ${settings.agingDays}d)`);
    }
  }

  let reason = "In Flow";
  if (isPenaltyBox) {
    reason = penaltyReasons[0] ?? `Not closed ${daysOpen} days after engagement (threshold: ${settings.penaltyBoxOpenDays}d)`;
  } else if (hasOverdue) {
    reason = `${overdueSteps.length} overdue ${overdueSteps.length === 1 ? "step" : "steps"}`;
  } else if (isBottlenecked) {
    reason = bottleneckReason ?? "Current Flow Stage exceeded expected time";
  } else if (isDueSoon) {
    reason = `${dueSoonSteps.length} due soon`;
  } else if (stageNearLimit && bottleneckMeta.elapsedDays !== null && bottleneckMeta.expectedDays !== null) {
    const remaining = Math.max(0, bottleneckMeta.expectedDays - bottleneckMeta.elapsedDays);
    reason = remaining === 0 ? "Current Flow Stage hits expected duration today" : `${remaining} day${remaining === 1 ? "" : "s"} left in stage`;
  }

  const topIssues: TopIssue[] = [];
  for (const step of overdueSteps.slice(0, 3)) {
    topIssues.push({
      stepName: step.label ?? `Step ${step.sortOrder}`,
      groupName: step.groupId ?? null,
      dueDate: resolveStepDueDate(step, dueContext)?.toISOString() ?? null,
      overdueDays: 1,
      type: "overdue"
    });
  }
  if (topIssues.length < 3 && isBottlenecked) {
    topIssues.push({
      stepName: "Current stage",
      groupName: bottleneckMeta.groupName,
      dueDate: null,
      overdueDays: 0,
      type: "bottleneck"
    });
  }
  if (topIssues.length < 3 && isAging) {
    topIssues.push({
      stepName: "Matter age",
      groupName: null,
      dueDate: null,
      overdueDays: 0,
      type: "aging"
    });
  }

  const statusLabel: MatterFlags["statusLabel"] = isPenaltyBox
    ? "Penalty Box"
    : hasOverdue || isBottlenecked
      ? "Bottlenecked"
      : isAtRisk
        ? "Needs Attention"
        : "On Track";

  return {
    isOverdue: hasOverdue,
    isDueSoon,
    isBottlenecked,
    isAging,
    isAtRisk,
    needsAttention,
    isPenaltyBox,
    overdueStepsCount: overdueSteps.length,
    dueSoonStepsCount: dueSoonSteps.length,
    daysSinceProgress,
    daysOpen,
    reason,
    statusLabel,
    bottleneckReason,
    bottleneckMeta,
    penaltyReasons,
    topIssues
  };
}
