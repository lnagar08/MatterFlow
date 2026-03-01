import { getGroupProgressStart, parseGroupProgress } from "@/lib/group-progress";
import { isOverdue, resolveStepDueDate } from "@/lib/step-overdue";

const DAY_MS = 1000 * 60 * 60 * 24;
const HOUR_MS = 1000 * 60 * 60;

type FlagSettings = {
  bottleneckNoProgressDays: number;
  noMovementDays: number;
  bottleneckDays?: number;
  defaultGroupExpectedDays: number;
  groupGraceDays: number;
  groupTimingEnabled?: boolean;
  agingDays: number;
  dueSoonHours: number;
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

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function diffInDays(a: Date, b: Date) {
  return Math.floor((startOfDayLocal(a).getTime() - startOfDayLocal(b).getTime()) / DAY_MS);
}

export function computeMatterFlags(matter: MatterInput, settings: FlagSettings, now = new Date()): MatterFlags {
  const nowMs = now.getTime();
  const openSteps = matter.steps.filter((step) => !(step.completed ?? step.isCompleted ?? false));
  const dueContext = {
    engagementDate: matter.engagementDate ?? null,
    createdAt: matter.createdAt
  };

  const overdueSteps = openSteps.filter((step) => isOverdue(step, dueContext, now));
  const dueSoonSteps = openSteps.filter((step) => {
    const dueDate = resolveStepDueDate(step, dueContext);
    if (!dueDate) return false;
    const dueMs = dueDate.getTime();
    return dueMs >= nowMs && dueMs <= nowMs + settings.dueSoonHours * HOUR_MS;
  });

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
          const date = toValidDate(step.completedAt ?? step.completedOn ?? step.updatedAt ?? step.createdAt);
          return date?.getTime();
        })
        .filter((value): value is number => typeof value === "number");

      const defaultStart =
        previousGroupCompletions.length > 0
          ? new Date(Math.max(...previousGroupCompletions))
          : new Date(matter.engagementDate ?? matter.createdAt);

      const progressStart = getGroupProgressStart(groupProgress, currentOpenStep.groupId, defaultStart);
      const groupDays = Math.floor((nowMs - progressStart.getTime()) / DAY_MS);
      const graceDays = Math.max(0, settings.groupGraceDays ?? 2);
      if (groupDays > expected + graceDays) {
        groupDurationExceeded = true;
        bottleneckReason = `Current stage exceeded expected time (${groupDays}d > Expected ${expected + graceDays}d)`;
        bottleneckMeta = {
          groupName: currentGroup?.title ?? `Group ${currentGroup?.sortOrder ?? ""}`.trim(),
          expectedDays: expected,
          elapsedDays: groupDays,
          graceDays
        };
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

  const needsAttention = hasOverdue || isBottlenecked || isDueSoon;
  const isAtRisk = needsAttention;

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
    : needsAttention
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
