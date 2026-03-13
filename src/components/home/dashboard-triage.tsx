"use client";

import { AlertOctagon, AlertTriangle, BriefcaseBusiness, Siren } from "lucide-react";

import { DashboardCard } from "@/components/dashboard-card";
import type { HomeMetrics } from "@/lib/home-data";

type DashboardAction = "in-flow" | "needs-attention" | "overdue" | "penalty-box" | "all-active";

type Row = {
  isOnTrack: boolean;
  isAtRisk: boolean;
  isOverdue: boolean;
  isBottlenecked: boolean;
  isPenaltyBox: boolean;
};

type Props = {
  metrics: HomeMetrics;
  rows: Row[];
  activeAction: DashboardAction | "none";
  onAction: (action: DashboardAction) => void;
};

export function DashboardTriage({ metrics, rows, activeAction, onAction }: Props) {
  // Set to false to restore previous 4-card layout quickly.
  const ENABLE_ACTIVE_MATTERS_CARD = true;

  const workload = rows.length;
  const inFlow = rows.filter((row) => row.isOnTrack).length;
  const atFlowRisk = rows.filter((row) => row.isAtRisk).length;
  const outOfFlow = rows.filter((row) => row.isOverdue || row.isBottlenecked).length;
  const penalty = rows.filter((row) => row.isPenaltyBox).length;
  const divisor = Math.max(1, workload);

  return (
    <section className={`dashboard-grid ${ENABLE_ACTIVE_MATTERS_CARD ? "dashboard-grid-five" : ""}`} aria-label="Flow control">
      {ENABLE_ACTIVE_MATTERS_CARD ? (
        <DashboardCard
          title="Active Matters"
          subtitle={`${Math.max(0, workload - inFlow)} need attention`}
          value={String(workload)}
          unit="active"
          barPercent={100}
          accent="black"
          icon={BriefcaseBusiness}
          active={activeAction === "all-active" || activeAction === "none"}
          ariaLabel="Show all active matters"
          onClick={() => onAction("all-active")}
        />
      ) : null}

      <DashboardCard
        title="In Flow"
        subtitle={`${inFlow} in flow`}
        value={String(inFlow)}
        unit={inFlow === 1 ? "matter" : "matters"}
        barPercent={(inFlow / divisor) * 100}
        accent="blue"
        icon={BriefcaseBusiness}
        active={activeAction === "in-flow"}
        ariaLabel="Show in-flow matters"
        onClick={() => onAction("in-flow")}
      />

      <DashboardCard
        title="At Flow Risk"
        subtitle={`Due within ${metrics.triage.operational.dueSoonHours}h`}
        value={String(atFlowRisk)}
        unit={atFlowRisk === 1 ? "matter" : "matters"}
        barPercent={(atFlowRisk / divisor) * 100}
        accent="amber"
        icon={AlertTriangle}
        active={activeAction === "needs-attention"}
        ariaLabel="Filter matters at flow risk"
        onClick={() => onAction("needs-attention")}
      />

      <DashboardCard
        title="Out of Flow"
        subtitle="Overdue steps or stage delay"
        value={String(outOfFlow)}
        unit={outOfFlow === 1 ? "matter" : "matters"}
        barPercent={(outOfFlow / divisor) * 100}
        accent="red"
        icon={AlertOctagon}
        active={activeAction === "overdue"}
        ariaLabel="Filter out of flow matters"
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
