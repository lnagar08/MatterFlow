"use client";

import { LucideIcon } from "lucide-react";

type Accent = "amber" | "red" | "rose" | "blue" | "black";

type Props = {
  title: string;
  subtitle: string;
  value: string;
  unit?: string;
  barPercent?: number;
  accent: Accent;
  icon: LucideIcon;
  active?: boolean;
  ariaLabel: string;
  onClick: () => void;
};

export function DashboardCard({
  title,
  subtitle,
  value,
  unit,
  barPercent = 70,
  accent,
  icon: Icon,
  active = false,
  ariaLabel,
  onClick
}: Props) {
  return (
    <button
      type="button"
      className={`dashboard-card dashboard-${accent}${active ? " active" : ""}`}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="dashboard-card-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="dashboard-card-title">{title}</span>
      <span className="dashboard-card-subtitle">{subtitle}</span>
      <span className="dashboard-card-value-wrap">
        <span className="dashboard-card-value">{value}</span>
        {unit ? <span className="dashboard-card-unit">{unit}</span> : null}
      </span>
      <span className="dashboard-card-track" aria-hidden="true">
        <span className="dashboard-card-underline" style={{ width: `${Math.max(16, Math.min(100, barPercent))}%` }} />
      </span>
    </button>
  );
}
