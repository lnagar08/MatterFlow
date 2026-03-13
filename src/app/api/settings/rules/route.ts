import { NextResponse } from "next/server";

import { getCurrentUserContext } from "@/lib/firm-access";
import { getFirmSettings } from "@/lib/firm-settings";
import { prisma } from "@/lib/prisma";

type RulesPayload = {
  bottleneckNoProgressDays?: number;
  noMovementDays?: number;
  bottleneckDays?: number;
  defaultGroupExpectedDays?: number;
  groupGraceDays?: number;
  groupTimingEnabled?: boolean;
  agingDays?: number;
  dueSoonHours?: number;
  atRiskStageWindowDays?: number;
  penaltyBoxOpenDays?: number;
  penaltyIncludeOverdue?: boolean;
  penaltyIncludeAging?: boolean;
};

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return NaN;
}

export async function GET() {
  const context = await getCurrentUserContext();
  const membership = context?.membership;
  if (!membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const settings = await getFirmSettings(membership.firmId);
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const context = await getCurrentUserContext();
  const membership = context?.membership;
  if (!membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (membership.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can update rules." }, { status: 403 });
  }

  const payload = (await request.json()) as RulesPayload;
  const current = await getFirmSettings(membership.firmId);
  const bottleneckNoProgressDays = asNumber(payload.bottleneckNoProgressDays);
  const noMovementDays = asNumber(payload.noMovementDays ?? payload.bottleneckDays);
  const bottleneckDays = asNumber(payload.bottleneckDays ?? payload.noMovementDays);
  const defaultGroupExpectedDays = asNumber(payload.defaultGroupExpectedDays);
  const groupGraceDays = asNumber(payload.groupGraceDays);
  const groupTimingEnabled = payload.groupTimingEnabled ?? true;
  const agingDays = asNumber(payload.agingDays);
  const dueSoonHours = asNumber(payload.dueSoonHours);
  const atRiskStageWindowDays = asNumber(payload.atRiskStageWindowDays ?? current.atRiskStageWindowDays);
  const penaltyBoxOpenDays = asNumber(payload.penaltyBoxOpenDays);
  const penaltyIncludeOverdue = payload.penaltyIncludeOverdue ?? true;
  const penaltyIncludeAging = payload.penaltyIncludeAging ?? true;

  if (!Number.isInteger(bottleneckNoProgressDays) || bottleneckNoProgressDays < 0 || bottleneckNoProgressDays > 30) {
    return NextResponse.json({ error: "Bottleneck grace days must be between 0 and 30." }, { status: 400 });
  }
  if (!Number.isInteger(noMovementDays) || noMovementDays < 1 || noMovementDays > 365) {
    return NextResponse.json({ error: "Bottleneck days must be between 1 and 365." }, { status: 400 });
  }
  if (!Number.isInteger(bottleneckDays) || bottleneckDays < 1 || bottleneckDays > 365) {
    return NextResponse.json({ error: "Bottleneck days must be between 1 and 365." }, { status: 400 });
  }
  if (!Number.isInteger(defaultGroupExpectedDays) || defaultGroupExpectedDays < 1 || defaultGroupExpectedDays > 365) {
    return NextResponse.json({ error: "Default group expected days must be between 1 and 365." }, { status: 400 });
  }
  if (!Number.isInteger(groupGraceDays) || groupGraceDays < 0 || groupGraceDays > 30) {
    return NextResponse.json({ error: "Group grace days must be between 0 and 30." }, { status: 400 });
  }
  if (!Number.isInteger(agingDays) || agingDays < 1 || agingDays > 3650) {
    return NextResponse.json({ error: "Aging days must be between 1 and 3650." }, { status: 400 });
  }
  if (!Number.isInteger(dueSoonHours) || dueSoonHours < 1 || dueSoonHours > 168) {
    return NextResponse.json({ error: "Due soon hours must be between 1 and 168." }, { status: 400 });
  }
  if (!Number.isInteger(atRiskStageWindowDays) || atRiskStageWindowDays < 0 || atRiskStageWindowDays > 30) {
    return NextResponse.json({ error: "At Flow Risk stage window days must be between 0 and 30." }, { status: 400 });
  }
  if (!Number.isInteger(penaltyBoxOpenDays) || penaltyBoxOpenDays < 1 || penaltyBoxOpenDays > 3650) {
    return NextResponse.json({ error: "Penalty Box open days must be between 1 and 3650." }, { status: 400 });
  }
  if (typeof groupTimingEnabled !== "boolean") {
    return NextResponse.json({ error: "Group timing enabled must be a boolean." }, { status: 400 });
  }
  if (typeof penaltyIncludeOverdue !== "boolean" || typeof penaltyIncludeAging !== "boolean") {
    return NextResponse.json({ error: "Penalty reason toggles must be booleans." }, { status: 400 });
  }

  const settings = await prisma.firmSettings.update({
    where: { id: current.id },
    data: {
      bottleneckNoProgressDays,
      noMovementDays,
      bottleneckDays,
      defaultGroupExpectedDays,
      groupGraceDays,
      groupTimingEnabled,
      agingDays,
      dueSoonHours,
      atRiskStageWindowDays,
      penaltyBoxOpenDays,
      penaltyIncludeOverdue,
      penaltyIncludeAging
    }
  });

  return NextResponse.json({ ok: true, settings });
}
