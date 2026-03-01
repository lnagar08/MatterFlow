"use client";

import { AlertOctagon, AlertTriangle, BriefcaseBusiness, Siren } from "lucide-react";

import { DashboardCard } from "@/components/dashboard-card";
import type { HomeMetrics } from "@/lib/home-data";

type DashboardAction = "needs-attention" | "overdue" | "penalty-box" | "workload";

type Row = {
  isAtRisk: boolean;
  isOverdue: boolean;
  isPenaltyBox: boolean;
};

type Props = {
  metrics: HomeMetrics;
  rows: Row[];
  activeAction: DashboardAction | "none";
  onAction: (action: DashboardAction) => void;
};

export function DashboardTriage({ metrics, rows, activeAction, onAction }: Props) {
  const workload = rows.length;
  const needsAttention = rows.filter((row) => row.isAtRisk || row.isPenaltyBox).length;
  const overdue = rows.filter((row) => row.isOverdue).length;
  const penalty = rows.filter((row) => row.isPenaltyBox).length;
  const divisor = Math.max(1, workload);

  return (
    <section className="dashboard-grid" aria-label="Flow control">
      <DashboardCard
        title="In Flow"
        subtitle={`${Math.max(0, workload - needsAttention)} in flow`}
        value={String(workload)}
        unit="active"
        barPercent={Math.min(100, 60 + (needsAttention / divisor) * 40)}
        accent="blue"
        icon={BriefcaseBusiness}
        active={activeAction === "workload"}
        ariaLabel="Show all active matters"
        onClick={() => onAction("workload")}
      />

      <DashboardCard
        title="At Flow Risk"
        subtitle={`Due soon or slipping (${metrics.triage.operational.dueSoonHours}h window)`}
        value={String(needsAttention)}
        unit={needsAttention === 1 ? "matter" : "matters"}
        barPercent={(needsAttention / divisor) * 100}
        accent="amber"
        icon={AlertTriangle}
        active={activeAction === "needs-attention"}
        ariaLabel="Filter matters at flow risk"
        onClick={() => onAction("needs-attention")}
      />

      <DashboardCard
        title="Out of Flow"
        subtitle="Incomplete steps due before today"
        value={String(overdue)}
        unit={overdue === 1 ? "matter" : "matters"}
        barPercent={(overdue / divisor) * 100}
        accent="red"
        icon={AlertOctagon}
        active={activeAction === "overdue"}
        ariaLabel="Filter overdue matters"
        onClick={() => onAction("overdue")}
      />

      <DashboardCard
        title="Flow Breakdown"
        subtitle={`Not closed within ${metrics.triage.operational.penaltyBoxDays} days`}
        value={String(penalty)}
        unit={penalty === 1 ? "matter" : "matters"}
        barPercent={(penalty / divisor) * 100}
        accent="rose"
        icon={Siren}
        active={activeAction === "penalty-box"}
        ariaLabel="Filter flow breakdown matters"
        onClick={() => onAction("penalty-box")}
      />
    </section>
  );
}
