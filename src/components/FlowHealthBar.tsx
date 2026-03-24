// components/FlowHealthBar.tsx
import React from "react";

export type StepStatus = "done" | "flagged" | "pending";

export interface Step {
  key: string;
  label: string;
  status: StepStatus;
  positionPercent: number; // exact position on bar (0–100)
}

interface FlowHealthBarProps {
  steps: Step[];
  completed: number;
  total: number;
  expectedDays: number;
  overdueDays: number | null;
}

const FlowHealthBar: React.FC<FlowHealthBarProps> = ({
  steps,
  completed,
  total,
  expectedDays,
  overdueDays,
}) => {
  const percent = (completed / total) * 100;

  const statusStyles: Record<StepStatus, { bg: string; icon: React.ReactNode }> = {
    done: {
      bg: "bg-emerald-600",
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    flagged: {
      bg: "bg-amber-400",
      icon: (
        <svg className="w-5 h-5 text-amber-800" viewBox="0 0 24 24" fill="none">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <path d="M12 9v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12 17h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
    },
    pending: {
      bg: "bg-slate-200",
      icon: (
        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
      ),
    },
  };

  return (
    <div className="w-full mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-md p-6 md:p-8">
        {/* Header */}
        <div className="flex justify-between">
          <h2 className="text-lg font-semibold">Flow Health Bar</h2>
          <div className="text-right">
            <p className="text-sm text-slate-500">Step Progress</p>
            <p className="text-sm font-medium">{completed} / {total} steps</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 relative">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Markers */}
          {steps.map((step) => {
            const styles = statusStyles[step.status];
            return (
              <div
                key={step.key}
                className="absolute -translate-x-1/2"
                style={{ left: `${step.positionPercent}%`, top: "-1.25rem" }}
              >
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ring-4 ring-white shadow-sm ${styles.bg}`}>
                  {styles.icon}
                </div>
                <div className="mt-2 text-center w-28 -translate-x-1/2">
                  <span className="block text-xs font-medium text-slate-700">{step.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Expected</p>
            <p className="text-sm font-semibold">{expectedDays} days</p>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-3">
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <div>
              <div className="font-semibold">OUT OF FLOW</div>
              <div className="text-xs text-red-700">+{overdueDays} days overdue</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlowHealthBar;
