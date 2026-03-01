import test from "node:test";
import assert from "node:assert/strict";

import { isOverdue, overdueDays, resolveStepDueDate } from "@/lib/step-overdue";

test("isOverdue uses local date-only comparison and does not mark today as overdue", () => {
  const now = new Date(2026, 1, 20, 12, 0, 0);
  const dueTodayMorning = new Date(2026, 1, 20, 8, 0, 0);

  const result = isOverdue(
    { completed: false, dueAt: dueTodayMorning },
    { engagementDate: new Date(2026, 1, 1), createdAt: new Date(2026, 1, 1) },
    now
  );

  assert.equal(result, false);
});

test("completed steps are never overdue", () => {
  const now = new Date(2026, 1, 20, 12, 0, 0);
  const oldDueDate = new Date(2026, 1, 10, 0, 0, 0);

  const result = isOverdue(
    { completed: true, dueAt: oldDueDate },
    { engagementDate: new Date(2026, 1, 1), createdAt: new Date(2026, 1, 1) },
    now
  );

  assert.equal(result, false);
});

test("overdueDays computes integer days late for past due steps", () => {
  const now = new Date(2026, 1, 20, 12, 0, 0);
  const pastDue = new Date(2026, 1, 17, 9, 30, 0);

  const days = overdueDays(
    { completed: false, dueAt: pastDue },
    { engagementDate: new Date(2026, 1, 1), createdAt: new Date(2026, 1, 1) },
    now
  );

  assert.equal(days, 3);
});

test("resolveStepDueDate falls back to engagementDate + dueDaysOffset", () => {
  const dueDate = resolveStepDueDate(
    { dueAt: null, dueDaysOffset: 7 },
    { engagementDate: new Date(2026, 1, 1), createdAt: new Date(2026, 1, 1) }
  );

  assert.ok(dueDate instanceof Date);
  assert.equal(dueDate?.getFullYear(), 2026);
  assert.equal(dueDate?.getMonth(), 1);
  assert.equal(dueDate?.getDate(), 8);
});

