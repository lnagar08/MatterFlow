import { getFirmSettings } from "@/lib/firm-settings";
import { computeMatterFlags, diffInDays } from "@/lib/matter-flags";
import { getGroupProgressStart, parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DAY_MS = 1000 * 60 * 60 * 24;

type Health = "Bottlenecked" | "At Risk" | "On Track";

type HomeDataInput = {
  firmId: string;
  query?: string;
};

export type DashboardPeekItem = {
  matterId: string;
  matterName: string;
  nextStep: string;
  dueAt: string | null;
  amount: number | null;
};

export type HomeRow = {
  id: string;
  clientLogoUrl: string;
  clientName: string;
  matterTitle: string;
  engagementDate: string;
  createdAt: string;
  daysOpen: number;
  amountPaid: number | null;
  overdueStepsCount: number;
  progressPercent: number;
  health: Health;
  reason: string;
  lastActivityAt: string;
  hasDueSoon: boolean;
  hasOverdue: boolean;
  isOverdue: boolean;
  isStalled: boolean;
  hasDueToday: boolean;
  hasDueThisWeek: boolean;
  isCashAtRisk: boolean;
  newIntakeToday: boolean;
  isAtRisk: boolean;
  isOnTrack: boolean;
  isBottlenecked: boolean;
  isAging: boolean;
  isPenaltyBox: boolean;
  statusLabel: "On Track" | "Needs Attention" | "Bottlenecked" | "Penalty Box";
  topIssues: Array<{ stepName: string; type: "overdue" | "dueSoon" | "bottleneck" | "aging"; overdueDays: number }>;
  nextStepLabel: string;
  nextStepDueAt: string | null;
  currentStageTitle: string;
  currentStageExpectedDays: number | null;
  currentStageElapsedDays: number | null;
  currentStageGraceDays: number;
  matterFlowName: string;
};

export type HomeMetrics = {
  activeCount: number;
  atRiskCount: number;
  bottleneckedCount: number;
  overdueStepsCount: number;
  avgDaysOpen: number;
  revenueInProgress: number;
  triage: {
    operational: {
      dueSoonHours: number;
      atRiskStageWindowDays: number;
      penaltyBoxDays: number;
    };
    financial: {
      revenueInProgress: number;
      unbilled: number;
      unpaid: number;
      avgFee: number | null;
      avgFeePeriod: "30d" | "all";
    };
    todayStrip: {
      todayDueCount: number;
      todayOverdueCount: number;
      todayStalledCount: number;
      weekDueCount: number;
      weekOverdueCount: number;
      newIntakeCount: number;
    };
    firmPulse: {
      completedThisWeek: number;
      trendVsLastWeek: number;
    };
  };
};

function toStartOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function completionBaseline(step: {
  completedAt: Date | null;
  dueAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  return (
    step.completedAt?.getTime() ??
    step.dueAt?.getTime() ??
    null
  );
}
type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}
export async function getHomeData({ firmId, query = "" }: HomeDataInput) {
  const session = await getServerSession(authOptions) as iSession;

  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  
  const normalized = query.trim().toLowerCase();
  const settings = await getFirmSettings(firmId);
  const now = new Date();
  const nowMs = now.getTime();
  const startOfToday = toStartOfToday(now);
  const startOfTomorrow = new Date(startOfToday.getTime() + DAY_MS);
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfWeek.getDay();
  const mondayOffset = (dayOfWeek + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - mondayOffset);
  const startOfNextWeek = new Date(startOfWeek.getTime() + 7 * DAY_MS);
  const startOfLastWeek = new Date(startOfWeek.getTime() - 7 * DAY_MS);
  const last30Days = new Date(nowMs - 30 * DAY_MS);

  const matters = await prisma.matter.findMany({
    where: {
	  userId: userid,
      firmId,
      archivedAt: null,
      closedAt: null
    },
    select: {
      id: true,
      title: true,
      engagementDate: true,
      amountPaid: true,
      createdAt: true,
      updatedAt: true,
      lastActivityAt: true,
      closedAt: true,
      groupProgress: true,
      client: {
        select: {
          name: true,
          logoUrl: true
        }
      },
      checklistGroups: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          expectedDurationDays: true,
          steps: {
            select: {
              id: true,
              label: true,
              completed: true,
              completedAt: true,
              dueDaysOffset: true,
              dueAt: true,
              sortOrder: true,
              groupId: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      },
      checklistSteps: {
        where: {
          groupId: null
        },
        select: {
          id: true,
          label: true,
          completed: true,
          completedAt: true,
          dueDaysOffset: true,
          dueAt: true,
          sortOrder: true,
          groupId: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  const templates = await prisma.matterTemplate.findMany({
    where: { userId: userid, firmId },
    select: {
      name: true,
      groups: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          expectedDurationDays: true
        }
      },
      steps: {
        select: {
          label: true,
          sortOrder: true,
          groupId: true,
          defaultDueDaysOffset: true
        }
      }
    },
    orderBy: { sortOrder: "asc" }
  });

  const templateSignatureToName = new Map<string, string>();
  const templateProfiles = templates.map((template) => {
    const groupTitles = new Set(template.groups.map((group) => normalizeToken(group.title)));
    const stepLabels = new Set(template.steps.map((step) => normalizeToken(step.label)));
    return {
      name: template.name,
      groupTitles,
      stepLabels
    };
  });
  for (const template of templates) {
    const groupSortById = new Map(template.groups.map((group) => [group.id, group.sortOrder]));
    const signature = JSON.stringify({
      groups: [...template.groups]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => ({
          sortOrder: group.sortOrder,
          title: group.title.trim().toLowerCase(),
          expectedDurationDays: group.expectedDurationDays ?? null
        })),
      steps: [...template.steps]
        .sort((a, b) => {
          const aGroupSort = a.groupId ? (groupSortById.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          const bGroupSort = b.groupId ? (groupSortById.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          if (aGroupSort !== bGroupSort) return aGroupSort - bGroupSort;
          return a.sortOrder - b.sortOrder;
        })
        .map((step) => ({
          groupSort: step.groupId ? (groupSortById.get(step.groupId) ?? null) : null,
          sortOrder: step.sortOrder,
          label: step.label.trim().toLowerCase(),
          dueDaysOffset: step.defaultDueDaysOffset ?? null
        }))
    });
    if (!templateSignatureToName.has(signature)) {
      templateSignatureToName.set(signature, template.name);
    }
  }

  const [completedThisWeek, completedLastWeek] = await Promise.all([
    prisma.matter.count({
      where: {
        firmId,
		    userId: userid,
        closedAt: {
          gte: startOfWeek,
          lt: startOfNextWeek
        }
      }
    }),
    prisma.matter.count({
      where: {
	    userId: userid,
        firmId,
        closedAt: {
          gte: startOfLastWeek,
          lt: startOfWeek
        }
      }
    })
  ]);

  const enriched = matters.map((matter, index) => {
    const allSteps = [...matter.checklistGroups.flatMap((group) => group.steps), ...matter.checklistSteps];
    const matterGroupSortById = new Map(matter.checklistGroups.map((group) => [group.id, group.sortOrder]));
    const matterSignature = JSON.stringify({
      groups: [...matter.checklistGroups]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((group) => ({
          sortOrder: group.sortOrder,
          title: group.title.trim().toLowerCase(),
          expectedDurationDays: group.expectedDurationDays ?? null
        })),
      steps: [...allSteps]
        .sort((a, b) => {
          const aGroupSort = a.groupId ? (matterGroupSortById.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          const bGroupSort = b.groupId ? (matterGroupSortById.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
          if (aGroupSort !== bGroupSort) return aGroupSort - bGroupSort;
          return a.sortOrder - b.sortOrder;
        })
        .map((step) => ({
          groupSort: step.groupId ? (matterGroupSortById.get(step.groupId) ?? null) : null,
          sortOrder: step.sortOrder,
          label: step.label.trim().toLowerCase(),
          dueDaysOffset: step.dueDaysOffset ?? null
        }))
    });
    const exactMatch = templateSignatureToName.get(matterSignature);
    let matterFlowName = exactMatch ?? "Custom Flow";
    if (!exactMatch) {
      const matterGroupTitles = new Set(matter.checklistGroups.map((group) => normalizeToken(group.title)));
      const matterStepLabels = new Set(allSteps.map((step) => normalizeToken(step.label)));
      let bestScore = 0;
      let bestName: string | null = null;

      for (const profile of templateProfiles) {
        const matchingGroups = [...matterGroupTitles].filter((title) => profile.groupTitles.has(title)).length;
        const matchingSteps = [...matterStepLabels].filter((label) => profile.stepLabels.has(label)).length;
        const groupScore = profile.groupTitles.size > 0 ? matchingGroups / profile.groupTitles.size : 0;
        const stepScore = profile.stepLabels.size > 0 ? matchingSteps / profile.stepLabels.size : 0;
        const score = groupScore * 0.45 + stepScore * 0.55;
        if (score > bestScore) {
          bestScore = score;
          bestName = profile.name;
        }
      }

      // Require a reasonable confidence to avoid random labeling.
      if (bestName && bestScore >= 0.5) {
        matterFlowName = bestName;
      }
    }
    const totalSteps = allSteps.length;
    const completedSteps = allSteps.filter((step) => step.completed).length;
    const progressPercent = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
    const flags = computeMatterFlags(
      {
        createdAt: matter.createdAt,
        updatedAt: matter.updatedAt,
        engagementDate: matter.engagementDate,
        closedAt: matter.closedAt,
        groups: matter.checklistGroups.map((group) => ({
          id: group.id,
          title: group.title,
          sortOrder: group.sortOrder,
          expectedDurationDays: group.expectedDurationDays
        })),
        groupProgress: matter.groupProgress,
        steps: allSteps.map((step) => ({
          id: step.id,
          label: step.label,
          completed: step.completed,
          completedAt: step.completedAt,
          dueDaysOffset: step.dueDaysOffset,
          dueAt: step.dueAt,
          sortOrder: step.sortOrder,
          groupId: step.groupId,
          updatedAt: step.updatedAt
        }))
      },
      {
        bottleneckNoProgressDays: settings.bottleneckNoProgressDays,
        noMovementDays: settings.noMovementDays,
        bottleneckDays: settings.bottleneckDays,
        defaultGroupExpectedDays: settings.defaultGroupExpectedDays,
        groupGraceDays: settings.groupGraceDays,
        groupTimingEnabled: settings.groupTimingEnabled,
        agingDays: settings.agingDays,
        dueSoonHours: settings.dueSoonHours,
        atRiskStageWindowDays: settings.atRiskStageWindowDays,
        penaltyBoxOpenDays: settings.penaltyBoxOpenDays,
        penaltyIncludeOverdue: settings.penaltyIncludeOverdue,
        penaltyIncludeAging: settings.penaltyIncludeAging
      },
      now
    );
    const nextStep = allSteps
      .filter((step) => !step.completed)
      .sort((a, b) => {
        const aOrder = a.groupId ? (matter.checklistGroups.find((group) => group.id === a.groupId)?.sortOrder ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const bOrder = b.groupId ? (matter.checklistGroups.find((group) => group.id === b.groupId)?.sortOrder ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.updatedAt.getTime() - b.updatedAt.getTime();
      })[0];
    const nextStepDueAt = nextStep?.dueAt ? new Date(nextStep.dueAt) : null;
    const currentStageTitle =
      nextStep?.groupId
        ? matter.checklistGroups.find((group) => group.id === nextStep.groupId)?.title ?? "Flow Stage"
        : "Flow Stage";
    const currentGroup = nextStep?.groupId
      ? matter.checklistGroups.find((group) => group.id === nextStep.groupId) ?? null
      : null;
    let currentStageExpectedDays: number | null = null;
    let currentStageElapsedDays: number | null = null;
    if (currentGroup) {
      const derivedExpectedDays =
        allSteps
          .filter((step) => step.groupId === currentGroup.id)
          .map((step) => step.dueDaysOffset)
          .filter((offset): offset is number => typeof offset === "number" && offset >= 0)
          .reduce((max, offset) => Math.max(max, offset), 0) || null;
      currentStageExpectedDays = currentGroup.expectedDurationDays ?? derivedExpectedDays ?? settings.defaultGroupExpectedDays;

      const previousGroupIds = new Set(
        matter.checklistGroups
          .filter((group) => group.sortOrder < currentGroup.sortOrder)
          .map((group) => group.id)
      );
      const currentStageFirstStep = allSteps
        .filter((step) => step.groupId === currentGroup.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)[0];
      const firstStepCompletedAtMs = currentStageFirstStep ? completionBaseline(currentStageFirstStep) : null;
      const previousStage = [...matter.checklistGroups]
        .filter((group) => group.sortOrder < currentGroup.sortOrder)
        .sort((a, b) => b.sortOrder - a.sortOrder)[0];
      const previousStageLastCompletedStep = previousStage
        ? allSteps
            .filter((step) => step.groupId === previousStage.id && step.completed)
            .sort((a, b) => b.sortOrder - a.sortOrder)[0]
        : null;
      const previousStageLastStepCompletedAtMs = previousStageLastCompletedStep
        ? completionBaseline(previousStageLastCompletedStep)
        : null;
      const previousCompletionTimes = allSteps
        .filter((step) => step.groupId && previousGroupIds.has(step.groupId) && step.completed)
        .map((step) => {
          const raw = step.completedAt;
          const parsed = raw ? new Date(raw).getTime() : Number.NaN;
          return Number.isNaN(parsed) ? null : parsed;
        })
        .filter((value): value is number => typeof value === "number");
      const anchoredStart =
        typeof previousStageLastStepCompletedAtMs === "number"
          ? new Date(Math.min(previousStageLastStepCompletedAtMs, now.getTime()))
          : typeof firstStepCompletedAtMs === "number"
            ? new Date(Math.min(firstStepCompletedAtMs, now.getTime()))
            : null;
      const defaultStart = anchoredStart
        ? anchoredStart
        : previousCompletionTimes.length > 0
          ? new Date(Math.max(...previousCompletionTimes))
          : (() => {
              const engagementOrCreated = new Date(matter.engagementDate ?? matter.createdAt);
              const currentGroupCompletedTimes = allSteps
                .filter((step) => step.groupId === currentGroup.id && step.completed && step.completedAt)
                .map((step) => step.completedAt!.getTime())
                .sort((a, b) => a - b);
              if (currentGroupCompletedTimes.length > 0) {
                return new Date(Math.min(currentGroupCompletedTimes[0], now.getTime()));
              }
              const currentGroupFirstStepCreated = allSteps
                .filter((step) => step.groupId === currentGroup.id)
                .map((step) => step.createdAt.getTime())
                .sort((a, b) => a - b)[0];
              if (currentGroupFirstStepCreated) {
                return new Date(Math.max(engagementOrCreated.getTime(), currentGroupFirstStepCreated));
              }
              return engagementOrCreated;
            })();
      const currentGroupCompletedTimes = allSteps
        .filter((step) => step.groupId === currentGroup.id && step.completed && step.completedAt)
        .map((step) => step.completedAt!.getTime())
        .sort((a, b) => a - b);
      const upperBound =
        typeof firstStepCompletedAtMs === "number"
          ? new Date(Math.min(firstStepCompletedAtMs, now.getTime()))
          : currentGroupCompletedTimes.length > 0
          ? new Date(Math.min(currentGroupCompletedTimes[0], now.getTime()))
          : now;
      const progressStart =
        anchoredStart ??
        getGroupProgressStart(
          parseGroupProgress(matter.groupProgress),
          currentGroup.id,
          defaultStart,
          upperBound
        );
      currentStageElapsedDays = diffInDays(now, progressStart);
    }
    const dueToday = nextStepDueAt
      ? nextStepDueAt.getTime() >= startOfToday.getTime() && nextStepDueAt.getTime() < startOfTomorrow.getTime()
      : false;
    const dueThisWeek = nextStepDueAt
      ? nextStepDueAt.getTime() >= startOfWeek.getTime() && nextStepDueAt.getTime() < startOfNextWeek.getTime()
      : false;
    const health: Health =
      flags.isOverdue || flags.isBottlenecked ? "Bottlenecked" : flags.isAtRisk ? "At Risk" : "On Track";

    if (process.env.NODE_ENV === "development" && index === 0) {
      console.log("[home-debug:first-matter]", {
        matterTitle: matter.title,
        stepCount: allSteps.length,
        stepsPreview: allSteps.slice(0, 3).map((step) => ({
          dueAt: step.dueAt ? new Date(step.dueAt).toISOString() : null,
          completedAt: step.completedAt ? new Date(step.completedAt).toISOString() : null
        })),
        flags
      });
    }

    return {
      id: matter.id,
      clientLogoUrl: matter.client.logoUrl,
      clientName: matter.client.name,
      matterTitle: matter.title,
      engagementDate: matter.engagementDate.toISOString(),
      createdAt: matter.createdAt.toISOString(),
      daysOpen: flags.daysOpen,
      amountPaid: matter.amountPaid ?? null,
      overdueStepsCount: flags.overdueStepsCount,
      progressPercent,
      health,
      reason: flags.reason,
      lastActivityAt: matter.lastActivityAt.toISOString(),
      hasDueSoon: flags.isDueSoon,
      hasOverdue: flags.isOverdue,
      isOverdue: flags.isOverdue,
      isStalled: flags.isBottlenecked,
      hasDueToday: dueToday,
      hasDueThisWeek: dueThisWeek,
      isCashAtRisk: flags.needsAttention || flags.isPenaltyBox,
      newIntakeToday: matter.createdAt >= startOfToday && matter.createdAt < startOfTomorrow,
      isAtRisk: flags.isAtRisk,
      isOnTrack: !flags.isAtRisk && !flags.isPenaltyBox && !flags.isOverdue && !flags.isBottlenecked,
      isBottlenecked: flags.isBottlenecked,
      isAging: flags.isAging,
      isPenaltyBox: flags.isPenaltyBox,
      statusLabel: flags.statusLabel,
      topIssues: flags.topIssues.map((issue) => ({
        stepName: issue.stepName,
        type: issue.type,
        overdueDays: issue.overdueDays
      })),
      nextStepLabel: nextStep?.label ?? "No pending step",
      nextStepDueAt: nextStepDueAt ? nextStepDueAt.toISOString() : null,
      currentStageTitle,
      currentStageExpectedDays,
      currentStageElapsedDays,
      currentStageGraceDays: settings.groupGraceDays,
      matterFlowName
    };
  });

  const rows = enriched.filter((row) => {
    if (!normalized) return true;
    return (
      row.clientName.toLowerCase().includes(normalized) ||
      row.matterTitle.toLowerCase().includes(normalized)
    );
  });

  const activeCount = rows.length;
  const atRiskCount = rows.filter((row) => row.isAtRisk).length;
  const bottleneckedCount = rows.filter((row) => row.isBottlenecked || row.isOverdue).length;
  const overdueStepsCount = rows.reduce((sum, row) => sum + row.overdueStepsCount, 0);
  const avgDaysOpen = activeCount === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.daysOpen, 0) / activeCount);
  const revenueInProgress = rows.reduce((sum, row) => sum + (row.amountPaid ?? 0), 0);

  const dueSoonRows = rows.filter((row) => row.hasDueSoon);
  const overdueRows = rows.filter((row) => row.hasOverdue);
  const stalledRows = rows.filter((row) => row.isStalled);
  const cashAtRiskRows = rows.filter((row) => row.isCashAtRisk);
  const todayDueCount = rows.filter((row) => row.hasDueToday).length;
  const weekDueCount = rows.filter((row) => row.hasDueThisWeek).length;
  const newIntakeCount = rows.filter((row) => row.newIntakeToday).length;
  const avgFee30Rows = rows.filter((row) => new Date(row.createdAt) >= last30Days && (row.amountPaid ?? 0) > 0);
  const avgFeeAllRows = rows.filter((row) => (row.amountPaid ?? 0) > 0);
  const avgFee30 =
    avgFee30Rows.length > 0
      ? Math.round(avgFee30Rows.reduce((sum, row) => sum + (row.amountPaid ?? 0), 0) / avgFee30Rows.length)
      : null;
  const avgFeeAll =
    avgFeeAllRows.length > 0
      ? Math.round(avgFeeAllRows.reduce((sum, row) => sum + (row.amountPaid ?? 0), 0) / avgFeeAllRows.length)
      : null;

  const metrics: HomeMetrics = {
    activeCount,
    atRiskCount,
    bottleneckedCount,
    overdueStepsCount,
    avgDaysOpen,
    revenueInProgress,
    triage: {
      operational: {
        dueSoonHours: settings.dueSoonHours,
        atRiskStageWindowDays: settings.atRiskStageWindowDays,
        penaltyBoxDays: settings.penaltyBoxOpenDays
      },
      financial: {
        revenueInProgress,
        unbilled: rows.filter((row) => (row.amountPaid ?? 0) === 0).length,
        unpaid: rows.filter((row) => row.hasOverdue).length,
        avgFee: avgFee30 ?? avgFeeAll,
        avgFeePeriod: avgFee30 !== null ? "30d" : "all"
      },
      todayStrip: {
        todayDueCount,
        todayOverdueCount: overdueRows.length,
        todayStalledCount: stalledRows.length,
        weekDueCount,
        weekOverdueCount: overdueRows.length,
        newIntakeCount
      },
      firmPulse: {
        completedThisWeek,
        trendVsLastWeek: completedThisWeek - completedLastWeek
      }
    }
  };

  return {
    rows: rows as HomeRow[],
    metrics
  };
}
