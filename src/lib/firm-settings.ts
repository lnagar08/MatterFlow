import { prisma } from "@/lib/prisma";

export const DEFAULT_FIRM_RULE_SETTINGS = {
  bottleneckNoProgressDays: 2,
  noMovementDays: 7,
  bottleneckDays: 7,
  defaultGroupExpectedDays: 7,
  groupGraceDays: 2,
  groupTimingEnabled: true,
  agingDays: 30,
  dueSoonHours: 48,
  atRiskStageWindowDays: 2,
  penaltyBoxOpenDays: 40,
  penaltyIncludeOverdue: true,
  penaltyIncludeBottleneck: true,
  penaltyIncludeAging: true
};

export type FirmRuleSettings = typeof DEFAULT_FIRM_RULE_SETTINGS;

export async function getFirmSettings(firmId: string) {
  const settings = await prisma.firmSettings.upsert({
    where: { firmId },
    update: {},
    create: {
      firmId,
      ...DEFAULT_FIRM_RULE_SETTINGS
    }
  });

  return settings;
}
