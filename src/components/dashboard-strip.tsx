"use client";

import { AlarmClock, AlertOctagon, AlertTriangle, DollarSign, Layers } from "lucide-react";

type HomeMetrics = {
  activeCount: number;
  atRiskCount: number;
  bottleneckedCount: number;
  overdueStepsCount: number;
  revenueInProgress: number;
};

type Props = {
  metrics: HomeMetrics;
  activeFilter: "all-active" | "at-risk" | "bottlenecked" | "overdue-steps";
  activeSort: "engagement" | "added" | "revenue";
  onAction: (target: "all-active" | "at-risk" | "bottlenecked" | "overdue-steps" | "revenue") => void;
};

function asCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function DashboardStrip({ metrics, activeFilter, activeSort, onAction }: Props) {
  return (
    <div className="metrics-strip" role="toolbar" aria-label="Flow Control">
      <article
        className={`metric-item metric-teal ${activeFilter === "all-active" ? "active" : ""}`}
        onClick={() => onAction("all-active")}
      >
        <span className="metric-icon">
          <Layers size={16} />
        </span>
        <div className="metric-copy">
          <div className="label">In Flow</div>
          <div className="metric-value">{metrics.activeCount}</div>
        </div>
      </article>

      <article
        className={`metric-item metric-amber ${activeFilter === "at-risk" ? "active" : ""}`}
        onClick={() => onAction("at-risk")}
      >
        <span className="metric-icon">
          <AlertTriangle size={16} />
        </span>
        <div className="metric-copy">
          <div className="label">At Flow Risk</div>
          <div className="metric-value">{metrics.atRiskCount}</div>
        </div>
      </article>

      <article
        className={`metric-item metric-rose ${activeFilter === "bottlenecked" ? "active" : ""}`}
        onClick={() => onAction("bottlenecked")}
      >
        <span className="metric-icon">
          <AlertOctagon size={16} />
        </span>
        <div className="metric-copy">
          <div className="label">Out of Flow</div>
          <div className="metric-value">{metrics.bottleneckedCount}</div>
        </div>
      </article>

      <article
        className={`metric-item metric-red ${activeFilter === "overdue-steps" ? "active" : ""}`}
        onClick={() => onAction("overdue-steps")}
      >
        <span className="metric-icon">
          <AlarmClock size={16} />
        </span>
        <div className="metric-copy">
          <div className="label">Overdue Flow Steps</div>
          <div className="metric-value">{metrics.overdueStepsCount}</div>
        </div>
      </article>

      <article
        className={`metric-item metric-emerald ${activeSort === "revenue" ? "active" : ""}`}
        onClick={() => onAction("revenue")}
      >
        <span className="metric-icon">
          <DollarSign size={16} />
        </span>
        <div className="metric-copy">
          <div className="label">Revenue In Progress</div>
          <div className="metric-value metric-value-strong">{asCurrency(metrics.revenueInProgress)}</div>
        </div>
      </article>
    </div>
  );
}
