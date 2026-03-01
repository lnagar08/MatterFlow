"use client";

type StatusLabel = "On Track" | "Needs Attention" | "Bottlenecked" | "Penalty Box";

type Row = {
  id: string;
  clientLogoUrl: string;
  clientName: string;
  matterTitle: string;
  progressPercent: number;
  statusLabel: StatusLabel;
  reason: string;
  amountPaid: number | null;
  isPenaltyBox: boolean;
  isOverdue: boolean;
  isBottlenecked: boolean;
  hasDueSoon: boolean;
};

type Props = {
  row: Row;
  sortMode: string;
};

function healthClass(statusLabel: StatusLabel) {
  if (statusLabel === "Penalty Box") return "danger";
  if (statusLabel === "Needs Attention") return "warning";
  if (statusLabel === "Bottlenecked") return "danger";
  return "success";
}

function toFlowStatusLabel(statusLabel: StatusLabel) {
  if (statusLabel === "Penalty Box") return "🚨 Flow Breakdown";
  if (statusLabel === "Bottlenecked") return "🔴 Out of Flow";
  if (statusLabel === "Needs Attention") return "🟡 At Flow Risk";
  return "🟢 In Flow";
}

function asCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export function MatterRowCard({ row, sortMode }: Props) {
  const health = row.isPenaltyBox || row.isOverdue ? "danger" : healthClass(row.statusLabel);
  const secondaryBadges = [
    row.isOverdue ? "Overdue" : null,
    row.isBottlenecked ? "Out of Flow" : null,
    row.hasDueSoon ? "Due Soon" : null
  ].filter(Boolean).slice(0, 2) as string[];

  return (
    <a key={row.id} href={`/matters/${row.id}?order=${sortMode}`} className="home-row-card">
      <img src={row.clientLogoUrl} alt={`${row.clientName} logo`} className="home-avatar" />

      <div className="home-row-main">
        <div className="home-title">{row.clientName + " - " + row.matterTitle}</div>
        <div className="home-progress-track">
          <div
            className={`home-progress-fill ${health}`}
            style={{
              width: `${Math.max(2, row.progressPercent)}%`
            }}
          />
        </div>
        <div className={`home-reason ${health}`}>{row.reason}</div>
        {secondaryBadges.length > 0 ? (
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            {secondaryBadges.map((badge) => (
              <span key={badge} className={`status ${health}`}>{badge}</span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="home-row-right">
        <div className={`amount-chip ${row.amountPaid && row.amountPaid > 0 ? "" : "muted"}`}>
          {row.amountPaid && row.amountPaid > 0 ? asCurrency(row.amountPaid) : "—"}
        </div>
        <div className={`home-health-badge ${health}`}>
          {row.statusLabel === "Needs Attention" ? <span aria-hidden="true">⚠ </span> : null}
          {toFlowStatusLabel(row.statusLabel)}
        </div>
      </div>
    </a>
  );
}
