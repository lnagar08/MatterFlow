import { notFound } from "next/navigation";

import { ApplyTemplateControl } from "@/components/apply-template-control";
import { AppNav } from "@/components/app-nav";
import { MatterActions } from "@/components/matter-actions";
import { MatterCard } from "@/components/matter-card";
import { requireFirmMembership } from "@/lib/firm-access";
import { getFirmSettings } from "@/lib/firm-settings";
import { computeMatterFlags } from "@/lib/matter-flags";
import { getFirmMatters, getMatterById } from "@/lib/matters";
import { isOverdue } from "@/lib/step-overdue";
import { getFirmTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";

type MatterDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ order?: string }>;
};

function asCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function asDate(input: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(input));
}

export default async function MatterDetailPage({ params, searchParams }: MatterDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const { membership } = await requireFirmMembership();
  const matter = await getMatterById(id, membership.firmId);

  if (!matter) {
    notFound();
  }

  const order =
    query.order === "engagement-asc" ||
    query.order === "engagement-desc" ||
    query.order === "added-asc" ||
    query.order === "added-desc"
      ? query.order
      : "engagement-desc";

  const matters = (await getFirmMatters(membership.firmId)).sort((a, b) => {
    const aTime =
      order === "engagement-asc" || order === "engagement-desc"
        ? new Date(a.engagementDate).getTime()
        : new Date(a.createdAt).getTime();
    const bTime =
      order === "engagement-asc" || order === "engagement-desc"
        ? new Date(b.engagementDate).getTime()
        : new Date(b.createdAt).getTime();
    return order === "engagement-asc" || order === "added-asc" ? aTime - bTime : bTime - aTime;
  });
  const [templates, settings] = await Promise.all([
    getFirmTemplates(membership.firmId),
    getFirmSettings(membership.firmId)
  ]);
  const flags = computeMatterFlags(
    {
      createdAt: matter.createdAt,
      updatedAt: matter.updatedAt,
      engagementDate: matter.engagementDate,
      closedAt: matter.closedAt,
      groupProgress: matter.groupProgress,
      groups: matter.checklistGroups.map((group) => ({
        id: group.id,
        title: group.title,
        sortOrder: group.sortOrder,
        expectedDurationDays: group.expectedDurationDays
      })),
      steps: [...matter.checklistGroups.flatMap((group) => group.steps), ...matter.checklistSteps].map((step) => ({
        id: step.id,
        label: step.label,
        completed: step.completed,
        completedAt: step.completedAt,
        dueAt: step.dueAt,
        dueDaysOffset: step.dueDaysOffset,
        sortOrder: step.sortOrder,
        groupId: step.groupId,
        updatedAt: step.updatedAt,
        createdAt: step.createdAt
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
      penaltyBoxOpenDays: settings.penaltyBoxOpenDays,
      penaltyIncludeOverdue: settings.penaltyIncludeOverdue,
      penaltyIncludeAging: settings.penaltyIncludeAging
    }
  );
  const index = matters.findIndex((item) => item.id === matter.id);
  const previousHref = index > 0 ? `/matters/${matters[index - 1].id}?order=${order}` : null;
  const nextHref = index < matters.length - 1 ? `/matters/${matters[index + 1].id}?order=${order}` : null;
  const checklistGroups = matter.checklistGroups.map((group) => ({
    id: group.id,
    title: group.title,
    indentLevel: group.indentLevel,
    expectedDurationDays: group.expectedDurationDays ?? null,
    steps: group.steps.map((step) => ({
      id: step.id,
      label: step.label,
      completed: step.completed,
      indentLevel: step.indentLevel,
      dueDaysOffset: step.dueDaysOffset,
      dueAt: step.dueAt ? step.dueAt.toISOString() : null
    }))
  }));
  const ungroupedSteps = matter.checklistSteps.map((step) => ({
    id: step.id,
    label: step.label,
    completed: step.completed,
    indentLevel: step.indentLevel,
    dueDaysOffset: step.dueDaysOffset,
    dueAt: step.dueAt ? step.dueAt.toISOString() : null
  }));
  const dueContext = {
    engagementDate: matter.engagementDate,
    createdAt: matter.createdAt
  };
  const highlightedStepIds = [
    ...matter.checklistGroups.flatMap((group) =>
      group.steps
        .filter((step) =>
          isOverdue(
            {
              completed: step.completed,
              dueAt: step.dueAt,
              dueDaysOffset: step.dueDaysOffset
            },
            dueContext
          )
        )
        .map((step) => step.id)
    ),
    ...matter.checklistSteps
      .filter((step) =>
        isOverdue(
          {
            completed: step.completed,
            dueAt: step.dueAt,
            dueDaysOffset: step.dueDaysOffset
          },
          dueContext
        )
      )
      .map((step) => step.id)
  ];

  return (
    <main>
      <AppNav />
      <section className="matter-hero glass-card">
        <div>
          <h1 className="matter-title">{matter.title}</h1>
          {flags.isPenaltyBox ? (
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <span className="status overdue">🚨 Flow Breakdown</span>
              <span className="meta">{`Not closed within ${settings.penaltyBoxOpenDays} days (open ${flags.daysOpen} days)`}</span>
            </div>
          ) : null}
        </div>
        <div className="row matter-hero-actions">
          <ApplyTemplateControl
            matterId={matter.id}
            templates={templates.map((template) => ({ id: template.id, name: template.name }))}
          />
          <MatterActions matterId={matter.id} />
        </div>
      </section>

      <MatterCard
        matterId={matter.id}
        clientName={matter.client.name}
        companyName={matter.client.companyName}
        clientLogoUrl={matter.client.logoUrl}
        engagementDate={asDate(matter.engagementDate)}
        engagementDateValue={matter.engagementDate.toISOString()}
        matterCreatedAtValue={matter.createdAt.toISOString()}
        defaultGroupExpectedDays={settings.defaultGroupExpectedDays}
        groupGraceDays={settings.groupGraceDays}
        groupProgress={matter.groupProgress}
        bottleneckMeta={flags.bottleneckMeta}
        isPenaltyBox={flags.isPenaltyBox}
        penaltyDaysOpen={flags.daysOpen}
        penaltyThreshold={settings.penaltyBoxOpenDays}
        amountPaid={asCurrency(matter.amountPaid)}
        blurb={matter.blurb}
        checklistGroups={checklistGroups}
        ungroupedSteps={ungroupedSteps}
        highlightedStepIds={highlightedStepIds}
        penaltyReason={flags.isPenaltyBox ? flags.penaltyReasons.join(" • ") : null}
        previousHref={previousHref}
        nextHref={nextHref}
      />
    </main>
  );
}
