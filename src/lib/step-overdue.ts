const DAY_MS = 1000 * 60 * 60 * 24;

type StepLike = {
  completed?: boolean;
  completedAt?: Date | string | null;
  dueAt?: Date | string | null;
  dueDate?: Date | string | null;
  dueDaysOffset?: number | null;
};

type DueDateContext = {
  engagementDate?: Date | string | null;
  createdAt?: Date | string | null;
};

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toStartOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function resolveStepDueDate(step: StepLike, context: DueDateContext): Date | null {
  const explicitDueDate = toValidDate(step.dueAt ?? step.dueDate);
  if (explicitDueDate) return explicitDueDate;

  if (typeof step.dueDaysOffset !== "number" || !Number.isFinite(step.dueDaysOffset)) {
    return null;
  }

  const baseDate = toValidDate(context.engagementDate ?? context.createdAt);
  if (!baseDate) return null;

  return new Date(baseDate.getTime() + step.dueDaysOffset * DAY_MS);
}

export function overdueDays(step: StepLike, context: DueDateContext, now = new Date()) {
  const dueDate = resolveStepDueDate(step, context);
  if (!dueDate) return 0;

  const dueDay = toStartOfLocalDay(dueDate);
  const today = toStartOfLocalDay(now);
  const diff = today.getTime() - dueDay.getTime();

  return diff > 0 ? Math.floor(diff / DAY_MS) : 0;
}

export function isOverdue(step: StepLike, context: DueDateContext, now = new Date()) {
  if (step.completed || step.completedAt) {
    return false;
  }
  return overdueDays(step, context, now) > 0;
}

