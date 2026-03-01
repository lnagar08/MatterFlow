import assert from "node:assert/strict";
import test from "node:test";

import { computeMatterFlags } from "@/lib/matter-flags";

const now = new Date("2026-03-01T12:00:00.000Z");

const settings = {
  bottleneckNoProgressDays: 2,
  noMovementDays: 7,
  bottleneckDays: 7,
  defaultGroupExpectedDays: 7,
  groupGraceDays: 2,
  groupTimingEnabled: true,
  agingDays: 30,
  dueSoonHours: 48,
  penaltyBoxOpenDays: 40,
  penaltyIncludeOverdue: true,
  penaltyIncludeAging: true
};

function baseMatter() {
  return {
    createdAt: new Date("2026-01-01T12:00:00.000Z"),
    updatedAt: new Date("2026-02-28T12:00:00.000Z"),
    engagementDate: new Date("2026-02-01T12:00:00.000Z"),
    closedAt: null,
    groupProgress: {
      g1: { startedAt: "2026-02-01T12:00:00.000Z" }
    },
    groups: [{ id: "g1", title: "Intake", sortOrder: 1, expectedDurationDays: 7 }],
    steps: [
      {
        id: "s1",
        label: "Collect docs",
        completed: false,
        dueAt: null,
        dueDaysOffset: null,
        sortOrder: 1,
        groupId: "g1",
        createdAt: new Date("2026-02-01T12:00:00.000Z"),
        updatedAt: new Date("2026-02-10T12:00:00.000Z")
      }
    ]
  };
}

test("marks overdue when incomplete step due date is in past", () => {
  const matter = baseMatter();
  matter.steps[0].dueAt = new Date("2026-02-25T12:00:00.000Z");
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isOverdue, true);
  assert.equal(flags.overdueStepsCount, 1);
});

test("marks due soon when due date is within dueSoon window", () => {
  const matter = baseMatter();
  matter.steps[0].dueAt = new Date("2026-03-02T10:00:00.000Z");
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isDueSoon, true);
  assert.equal(flags.dueSoonStepsCount, 1);
});

test("marks bottleneck when no progress exceeds bottleneckDays", () => {
  const matter = baseMatter();
  matter.updatedAt = new Date("2026-02-15T12:00:00.000Z");
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isBottlenecked, true);
});

test("marks aging when open more than agingDays", () => {
  const matter = baseMatter();
  matter.engagementDate = new Date("2025-12-15T12:00:00.000Z");
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isAging, true);
});

test("marks penalty box when open more than penaltyBoxOpenDays", () => {
  const matter = baseMatter();
  matter.engagementDate = new Date("2025-12-01T12:00:00.000Z");
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isPenaltyBox, true);
  assert.ok(flags.penaltyReasons.length > 0);
});

test("marks on track when no risk flags are present", () => {
  const matter = baseMatter();
  matter.updatedAt = new Date("2026-03-01T10:00:00.000Z");
  matter.engagementDate = new Date("2026-02-28T12:00:00.000Z");
  matter.groupProgress = { g1: { startedAt: "2026-02-28T12:00:00.000Z" } };
  matter.groups[0].expectedDurationDays = 30;
  const flags = computeMatterFlags(matter, settings, now);
  assert.equal(flags.isOverdue, false);
  assert.equal(flags.isDueSoon, false);
  assert.equal(flags.isBottlenecked, false);
  assert.equal(flags.isAging, false);
  assert.equal(flags.isPenaltyBox, false);
  assert.equal(flags.statusLabel, "On Track");
});

