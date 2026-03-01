import { DEFAULT_FIRM_RULE_SETTINGS, type FirmRuleSettings } from "@/lib/firm-settings";
import { computeMatterFlags } from "@/lib/matter-flags";
import { isOverdue } from "@/lib/step-overdue";

type MatterStep = {
  id: string;
  label?: string;
  completed: boolean;
  dueDaysOffset: number | null;
  dueAt: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  completedAt?: Date | string | null;
  sortOrder?: number;
  groupId?: string | null;
};

type MatterWithChecklist = {
  engagementDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date | null;
  groupProgress?: unknown;
  lastActivityAt?: Date;
  checklistGroups: Array<{ id?: string; title?: string; sortOrder?: number; expectedDurationDays?: number | null; steps: MatterStep[] }>;
  checklistSteps: MatterStep[];
};

export function getMatterPenaltyInfo(matter: MatterWithChecklist, settings: FirmRuleSettings = DEFAULT_FIRM_RULE_SETTINGS) {
  const fallbackTimestamp = matter.updatedAt ?? matter.lastActivityAt ?? matter.engagementDate;
  const allSteps = [
    ...matter.checklistGroups.flatMap((group) =>
      group.steps.map((step) => ({ ...step, groupId: step.groupId ?? group.id }))
    ),
    ...matter.checklistSteps
  ];
  const evaluation = computeMatterFlags(
    {
      createdAt: matter.createdAt ?? matter.engagementDate,
      updatedAt: matter.updatedAt ?? fallbackTimestamp,
      engagementDate: matter.engagementDate,
      closedAt: matter.closedAt ?? null,
      groups: matter.checklistGroups.map((group, index) => ({
        id: group.id ?? `group-${index + 1}`,
        title: group.title,
        sortOrder: group.sortOrder ?? index + 1,
        expectedDurationDays: group.expectedDurationDays ?? null
      })),
      groupProgress: matter.groupProgress,
      steps: allSteps.map((step, index) => ({
        id: step.id,
        label: step.label,
        completed: step.completed,
        completedAt: step.completedAt ? new Date(step.completedAt) : null,
        dueDaysOffset: step.dueDaysOffset,
        dueAt: step.dueAt ? new Date(step.dueAt) : null,
        sortOrder: step.sortOrder ?? index + 1,
        groupId: step.groupId ?? null,
        updatedAt: step.updatedAt ? new Date(step.updatedAt) : new Date(fallbackTimestamp)
      }))
    },
    settings
  );

  const overdueStepIds = allSteps
    .filter((step) =>
      isOverdue(
        {
          completed: step.completed,
          completedAt: step.completedAt ?? null,
          dueAt: step.dueAt ?? null,
          dueDaysOffset: step.dueDaysOffset
        },
        {
          engagementDate: matter.engagementDate,
          createdAt: matter.createdAt ?? matter.engagementDate
        }
      )
    )
    .map((step) => step.id);

  return {
    agedOpen: evaluation.isPenaltyBox,
    stale: evaluation.isBottlenecked,
    overdue: evaluation.isOverdue,
    atRisk: evaluation.isAtRisk,
    reason: evaluation.reason,
    overdueStepIds
  };
}
