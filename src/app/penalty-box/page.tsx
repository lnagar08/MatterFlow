import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { requireFirmMembership } from "@/lib/firm-access";
import { getFirmSettings } from "@/lib/firm-settings";
import { computeMatterFlags } from "@/lib/matter-flags";
import { getFirmMatters } from "@/lib/matters";

export const dynamic = "force-dynamic";

export default async function PenaltyBoxPage() {
  const { membership } = await requireFirmMembership();
  const [matters, settings] = await Promise.all([
    getFirmMatters(membership.firmId),
    getFirmSettings(membership.firmId)
  ]);
  const flagged = matters
    .map((matter) => ({
      matter,
      info: computeMatterFlags(
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
          steps: [...matter.checklistGroups.flatMap((group) => group.steps), ...matter.checklistSteps].map((step) => ({
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
        }
      )
    }))
    .filter((entry) => entry.info.isPenaltyBox);

  return (
    <main>
      <AppNav active="penalty" />
      <div className="header-row">
        <h1 style={{ margin: 0 }}>Flow Breakdown</h1>
        <Link className="button" href="/home">
          Back to Flow Control
        </Link>
      </div>

      {flagged.length === 0 ? (
        <div className="card">No matters are currently in Flow Breakdown.</div>
      ) : (
        <div className="matter-list">
          {flagged.map(({ matter, info }) => {
            return (
              <Link key={matter.id} href={`/matters/${matter.id}`} className="list-item penalty-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{matter.title}</strong>
                  <div className="row">
                    <span className="status overdue">Open {info.daysOpen} days</span>
                  </div>
                </div>
                <div className="meta">{matter.client.name}</div>
                <div className="meta penalty-emphasis" style={{ marginTop: 6 }}>
                  Why in Flow Breakdown: {info.penaltyReasons.join(" • ") || info.reason || `Not closed ${info.daysOpen} days after engagement (threshold: ${settings.penaltyBoxOpenDays}d)`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
