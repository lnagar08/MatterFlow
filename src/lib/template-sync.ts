import { Prisma } from "@prisma/client";
import { buildGroupProgressPayload, getTemplateLink, parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
type iSession = {
  user: {
    id:string;
    role: string;
    parentId: string;
  }
}
type SnapshotGroup = {
  id: string;
  title: string;
  sortOrder: number;
  indentLevel: number;
  expectedDurationDays: number | null;
};

type SnapshotStep = {
  id: string;
  groupId: string | null;
  label: string;
  sortOrder: number;
  indentLevel: number;
  defaultDueDaysOffset: number | null;
};

type TemplateSnapshot = {
  templateId: string;
  groups: SnapshotGroup[];
  steps: SnapshotStep[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function withOccurrenceKey(items: Array<{ groupName: string; label: string }>) {
  const counters = new Map<string, number>();
  return items.map((item) => {
    const base = `${normalize(item.groupName)}::${normalize(item.label)}`;
    const next = (counters.get(base) ?? 0) + 1;
    counters.set(base, next);
    return `${base}::${next}`;
  });
}

export function snapshotSignature(snapshot: { groups: SnapshotGroup[]; steps: SnapshotStep[] }) {
  const groupSortById = new Map(snapshot.groups.map((group) => [group.id, group.sortOrder]));
  return JSON.stringify({
    groups: [...snapshot.groups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => ({
        sortOrder: group.sortOrder,
        title: normalize(group.title),
        expectedDurationDays: group.expectedDurationDays ?? null
      })),
    steps: [...snapshot.steps]
      .sort((a, b) => {
        const aGroupSort = a.groupId ? (groupSortById.get(a.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        const bGroupSort = b.groupId ? (groupSortById.get(b.groupId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
        if (aGroupSort !== bGroupSort) return aGroupSort - bGroupSort;
        return a.sortOrder - b.sortOrder;
      })
      .map((step) => ({
        groupSort: step.groupId ? (groupSortById.get(step.groupId) ?? null) : null,
        sortOrder: step.sortOrder,
        label: normalize(step.label),
        dueDaysOffset: step.defaultDueDaysOffset ?? null
      }))
  });
}

export async function getTemplateSnapshot(templateId: string) {
  const session = await getServerSession(authOptions) as iSession;
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  const template = await prisma.matterTemplate.findUnique({
    where: { id: templateId },
    include: {
      groups: {
        orderBy: { sortOrder: "asc" }
      },
      steps: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!template) return null;
  const snapshot: TemplateSnapshot = {
    templateId,
    groups: template.groups.map((group) => ({
      id: group.id,
      title: group.title,
      sortOrder: group.sortOrder,
      indentLevel: group.indentLevel,
      expectedDurationDays: group.expectedDurationDays
    })),
    steps: template.steps.map((step) => ({
      id: step.id,
      groupId: step.groupId,
      label: step.label,
      sortOrder: step.sortOrder,
      indentLevel: step.indentLevel,
      defaultDueDaysOffset: step.defaultDueDaysOffset
    }))
  };
  return snapshot;
}

export async function syncTemplateToMatters(args: {
  firmId: string;
  templateId: string;
  previousSignature: string;
  previousSnapshot?: TemplateSnapshot | null;
}) {
  const template = await getTemplateSnapshot(args.templateId);
  if (!template) return { synced: 0 };
const session = await getServerSession(authOptions) as iSession;
  const userid = (session.user.role === 'STAFF'? session.user.parentId: session.user.id);
  const matters = await prisma.matter.findMany({
    
    where: {
      userId: userid,
      firmId: args.firmId,
      archivedAt: null,
      closedAt: null
    },
    include: {
      checklistGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            orderBy: { sortOrder: "asc" }
          }
        }
      },
      checklistSteps: {
        where: { groupId: null },
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  let synced = 0;

  const previousGroupTitles = new Set((args.previousSnapshot?.groups ?? []).map((group) => normalize(group.title)));
  const previousStepLabels = (args.previousSnapshot?.steps ?? []).map((step) => normalize(step.label));
  const previousStepTotal = previousStepLabels.length;

  for (const matter of matters) {
    const matterGroups = matter.checklistGroups.map((group) => ({
      id: group.id,
      title: group.title,
      sortOrder: group.sortOrder,
      indentLevel: group.indentLevel,
      expectedDurationDays: group.expectedDurationDays
    }));
    const matterSteps = [
      ...matter.checklistGroups.flatMap((group) =>
        group.steps.map((step) => ({
          id: step.id,
          groupId: step.groupId,
          label: step.label,
          sortOrder: step.sortOrder,
          indentLevel: step.indentLevel,
          defaultDueDaysOffset: step.dueDaysOffset
        }))
      ),
      ...matter.checklistSteps.map((step) => ({
        id: step.id,
        groupId: step.groupId,
        label: step.label,
        sortOrder: step.sortOrder,
        indentLevel: step.indentLevel,
        defaultDueDaysOffset: step.dueDaysOffset
      }))
    ];

    const strictMatch = snapshotSignature({ groups: matterGroups, steps: matterSteps }) === args.previousSignature;
    const linkedTemplate = getTemplateLink(matter.groupProgress);
    const linkedMatch = linkedTemplate === args.templateId;
    let fuzzyMatch = false;
    if (!strictMatch && !linkedMatch && args.previousSnapshot && previousStepTotal > 0) {
      const matterGroupTitles = new Set(matterGroups.map((group) => normalize(group.title)));
      const matterStepLabels = matterSteps.map((step) => normalize(step.label));
      const previousStepCounts = new Map<string, number>();
      const matterStepCounts = new Map<string, number>();
      for (const label of previousStepLabels) previousStepCounts.set(label, (previousStepCounts.get(label) ?? 0) + 1);
      for (const label of matterStepLabels) matterStepCounts.set(label, (matterStepCounts.get(label) ?? 0) + 1);

      let matchedStepCount = 0;
      for (const [label, count] of previousStepCounts.entries()) {
        matchedStepCount += Math.min(count, matterStepCounts.get(label) ?? 0);
      }
      const stepCoverage = matchedStepCount / previousStepTotal;
      const matchedGroups = [...previousGroupTitles].filter((title) => matterGroupTitles.has(title)).length;
      const groupCoverage = previousGroupTitles.size > 0 ? matchedGroups / previousGroupTitles.size : 1;
      fuzzyMatch = stepCoverage >= 0.85 && groupCoverage >= 0.85;
    }

    if (!strictMatch && !linkedMatch && !fuzzyMatch) continue;

    const oldGroupById = new Map(matter.checklistGroups.map((group) => [group.id, group]));
    const oldStepStateByKey = new Map<
      string,
      { completed: boolean; completedAt: Date | null; dueAt: Date | null }
    >();
    const flattenedOldSteps = [
      ...matter.checklistGroups.flatMap((group) =>
        group.steps.map((step) => ({
          groupName: group.title,
          label: step.label,
          completed: step.completed,
          completedAt: step.completedAt,
          dueAt: step.dueAt
        }))
      ),
      ...matter.checklistSteps.map((step) => ({
        groupName: "__ungrouped__",
        label: step.label,
        completed: step.completed,
        completedAt: step.completedAt,
        dueAt: step.dueAt
      }))
    ];
    const keys = withOccurrenceKey(flattenedOldSteps.map((step) => ({ groupName: step.groupName, label: step.label })));
    flattenedOldSteps.forEach((step, index) => {
      oldStepStateByKey.set(keys[index], {
        completed: step.completed,
        completedAt: step.completedAt,
        dueAt: step.dueAt
      });
    });

    const newGroupTitleByTemplateGroupId = new Map(template.groups.map((group) => [group.id, group.title]));

    await prisma.$transaction(async (tx) => {
      await tx.checklistStep.deleteMany({ where: { matterId: matter.id } });
      await tx.checklistGroup.deleteMany({ where: { matterId: matter.id } });

      const newMatterGroupByTemplateGroupId = new Map<string, { id: string; title: string }>();
      for (const group of template.groups) {
        const createdGroup = await tx.checklistGroup.create({
          data: {
            matterId: matter.id,
            title: group.title,
            sortOrder: group.sortOrder,
            indentLevel: group.indentLevel,
            expectedDurationDays: group.expectedDurationDays
          }
        });
        newMatterGroupByTemplateGroupId.set(group.id, { id: createdGroup.id, title: createdGroup.title });
      }

      const newStepDescriptors = template.steps.map((step) => ({
        groupName: step.groupId ? (newGroupTitleByTemplateGroupId.get(step.groupId) ?? "__ungrouped__") : "__ungrouped__",
        label: step.label
      }));
      const newKeys = withOccurrenceKey(newStepDescriptors);

      for (const [index, step] of template.steps.entries()) {
        const state = oldStepStateByKey.get(newKeys[index]);
        await tx.checklistStep.create({
          data: {
            matterId: matter.id,
            groupId: step.groupId ? (newMatterGroupByTemplateGroupId.get(step.groupId)?.id ?? null) : null,
            label: step.label,
            sortOrder: step.sortOrder,
            indentLevel: step.indentLevel,
            dueDaysOffset: step.defaultDueDaysOffset,
            completed: state?.completed ?? false,
            completedAt: state?.completedAt ?? null,
            dueAt: state?.dueAt ?? null
          }
        });
      }

      const oldProgress = parseGroupProgress(matter.groupProgress);
      const nextProgress: Record<string, { startedAt: string }> = {};
      for (const [oldGroupId, progress] of Object.entries(oldProgress)) {
        const oldGroup = oldGroupById.get(oldGroupId);
        if (!oldGroup) continue;
        const matchedNewGroup = [...newMatterGroupByTemplateGroupId.values()].find(
          (group) => normalize(group.title) === normalize(oldGroup.title)
        );
        if (matchedNewGroup) {
          nextProgress[matchedNewGroup.id] = { startedAt: progress.startedAt };
        }
      }

      await tx.matter.update({
        where: { id: matter.id },
        data: {
          groupProgress: buildGroupProgressPayload(nextProgress, {
            templateId: args.templateId,
            existingRaw: matter.groupProgress
          }) as Prisma.InputJsonValue,
          lastActivityAt: new Date()
        }
      });
    });

    synced += 1;
  }

  return { synced };
}
