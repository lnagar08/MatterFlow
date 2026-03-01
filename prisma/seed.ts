import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const firm = await prisma.firm.upsert({
    where: { name: "PPM LAWYERS" },
    update: {},
    create: { name: "PPM LAWYERS" }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@ppmlawyers.com" },
    update: {
      name: "PPM Admin",
      emailVerified: new Date()
    },
    create: {
      name: "PPM Admin",
      email: "admin@ppmlawyers.com",
      emailVerified: new Date()
    }
  });

  await prisma.firmMembership.upsert({
    where: { userId: admin.id },
    update: {
      firmId: firm.id,
      role: "ADMIN"
    },
    create: {
      firmId: firm.id,
      userId: admin.id,
      role: "ADMIN"
    }
  });

  const defaultTemplate =
    (await prisma.matterTemplate.findFirst({
      where: {
        firmId: firm.id,
        name: "Default Litigation Template"
      }
    })) ??
    (await prisma.matterTemplate.create({
      data: {
        firmId: firm.id,
        name: "Default Litigation Template",
        sortOrder: 1
      }
    }));

  await prisma.matterTemplate.update({
    where: { id: defaultTemplate.id },
    data: { sortOrder: 1 }
  });

  const transactionTemplate =
    (await prisma.matterTemplate.findFirst({
      where: {
        firmId: firm.id,
        name: "M&A Transaction Workflow"
      }
    })) ??
    (await prisma.matterTemplate.create({
      data: {
        firmId: firm.id,
        name: "M&A Transaction Workflow",
        sortOrder: 2
      }
    }));

  await prisma.matterTemplate.update({
    where: { id: transactionTemplate.id },
    data: { sortOrder: 2 }
  });

  const diligenceGroup =
    (await prisma.templateGroup.findFirst({
      where: {
        templateId: transactionTemplate.id,
        title: "Diligence"
      }
    })) ??
    (await prisma.templateGroup.create({
      data: {
        templateId: transactionTemplate.id,
        title: "Diligence",
        sortOrder: 1,
        indentLevel: 0,
        expectedDurationDays: 10
      }
    }));

  const closingGroup =
    (await prisma.templateGroup.findFirst({
      where: {
        templateId: transactionTemplate.id,
        title: "Closing"
      }
    })) ??
    (await prisma.templateGroup.create({
      data: {
        templateId: transactionTemplate.id,
        title: "Closing",
        sortOrder: 2,
        indentLevel: 0,
        expectedDurationDays: 14
      }
    }));

  await prisma.templateGroup.update({
    where: { id: diligenceGroup.id },
    data: { sortOrder: 1, indentLevel: 0, expectedDurationDays: 10 }
  });

  await prisma.templateGroup.update({
    where: { id: closingGroup.id },
    data: { sortOrder: 2, indentLevel: 0, expectedDurationDays: 14 }
  });

  const templateSteps = [
    {
      label: "Collect disclosure schedules",
      sortOrder: 1,
      indentLevel: 0,
      defaultDueDaysOffset: 3,
      groupId: diligenceGroup.id
    },
    {
      label: "Review IP assignment chain",
      sortOrder: 2,
      indentLevel: 1,
      defaultDueDaysOffset: 7,
      groupId: diligenceGroup.id
    },
    {
      label: "Finalize signature packet",
      sortOrder: 3,
      indentLevel: 0,
      defaultDueDaysOffset: 14,
      groupId: closingGroup.id
    },
    {
      label: "Send weekly deal status summary",
      sortOrder: 4,
      indentLevel: 0,
      defaultDueDaysOffset: null,
      groupId: null
    }
  ];

  for (const step of templateSteps) {
    const existingStep = await prisma.templateStep.findFirst({
      where: {
        templateId: transactionTemplate.id,
        label: step.label
      }
    });

    if (existingStep) {
      await prisma.templateStep.update({
        where: { id: existingStep.id },
        data: step
      });
      continue;
    }

    await prisma.templateStep.create({
      data: {
        templateId: transactionTemplate.id,
        ...step
      }
    });
  }

  await prisma.firmSetting.upsert({
    where: {
      firmId_key: {
        firmId: firm.id,
        key: "defaultMatterStatusWindowDays"
      }
    },
    update: { value: "7" },
    create: {
      firmId: firm.id,
      key: "defaultMatterStatusWindowDays",
      value: "7"
    }
  });

  await prisma.firmSettings.upsert({
    where: { firmId: firm.id },
    update: {
      bottleneckNoProgressDays: 7,
      noMovementDays: 7,
      bottleneckDays: 7,
      defaultGroupExpectedDays: 7,
      groupGraceDays: 2,
      groupTimingEnabled: true,
      agingDays: 30,
      dueSoonHours: 48,
      penaltyBoxOpenDays: 40,
      penaltyIncludeOverdue: true,
      penaltyIncludeBottleneck: true,
      penaltyIncludeAging: true
    },
    create: {
      firmId: firm.id,
      bottleneckNoProgressDays: 7,
      noMovementDays: 7,
      bottleneckDays: 7,
      defaultGroupExpectedDays: 7,
      groupGraceDays: 2,
      groupTimingEnabled: true,
      agingDays: 30,
      dueSoonHours: 48,
      penaltyBoxOpenDays: 40,
      penaltyIncludeOverdue: true,
      penaltyIncludeBottleneck: true,
      penaltyIncludeAging: true
    }
  });

  const clientOne =
    (await prisma.client.findFirst({
      where: {
        firmId: firm.id,
        name: "Nora Patel",
        companyName: "Helios Dynamics"
      }
    })) ??
    (await prisma.client.create({
      data: {
        firmId: firm.id,
        name: "Nora Patel",
        companyName: "Helios Dynamics",
        logoUrl:
          "https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=120&q=80"
      }
    }));

  const clientTwo =
    (await prisma.client.findFirst({
      where: {
        firmId: firm.id,
        name: "Adrian Wells",
        companyName: "Blue Harbor Manufacturing"
      }
    })) ??
    (await prisma.client.create({
      data: {
        firmId: firm.id,
        name: "Adrian Wells",
        companyName: "Blue Harbor Manufacturing",
        logoUrl:
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&q=80"
      }
    }));

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const seedMatters = [
    {
      title: "Trademark Portfolio Expansion",
      blurb: "Expanding and formalizing domestic and international marks for FY26 launch windows.",
      engagementDate: new Date(now - 60 * day),
      amountPaid: 42000,
      dueDate: new Date(now + 12 * day),
      lastActivityAt: new Date(now - 2 * day),
      firmId: firm.id,
      clientId: clientOne.id
    },
    {
      title: "Employment Dispute - Clark v. Helios",
      blurb:
        "Pre-litigation response and settlement posture analysis with weekly executive updates.",
      engagementDate: new Date(now - 45 * day),
      amountPaid: 36500,
      dueDate: new Date(now + 18 * day),
      lastActivityAt: new Date(now - 15 * day),
      firmId: firm.id,
      clientId: clientOne.id
    },
    {
      title: "Vendor Contract Breach Review",
      blurb:
        "Analyzing breach remedies, notice timeline, and claim exposure across master services agreements.",
      engagementDate: new Date(now - 35 * day),
      amountPaid: 28000,
      dueDate: new Date(now - 3 * day),
      lastActivityAt: new Date(now - 2 * day),
      firmId: firm.id,
      clientId: clientTwo.id
    }
  ];

  const matters = [];
  for (const matterData of seedMatters) {
    const existingMatter = await prisma.matter.findFirst({
      where: {
        firmId: matterData.firmId,
        title: matterData.title,
        clientId: matterData.clientId
      }
    });

    if (existingMatter) {
      matters.push(existingMatter);
      continue;
    }

    const createdMatter = await prisma.matter.create({
      data: matterData
    });
    matters.push(createdMatter);
  }

  for (const matter of matters) {
    const intake =
      (await prisma.checklistGroup.findFirst({
        where: {
          matterId: matter.id,
          title: "Intake"
        }
      })) ??
      (await prisma.checklistGroup.create({
        data: {
          title: "Intake",
          sortOrder: 1,
          indentLevel: 0,
          expectedDurationDays: 7,
          matterId: matter.id
        }
      }));

    const strategy =
      (await prisma.checklistGroup.findFirst({
        where: {
          matterId: matter.id,
          title: "Strategy"
        }
      })) ??
      (await prisma.checklistGroup.create({
        data: {
          title: "Strategy",
          sortOrder: 2,
          indentLevel: 0,
          expectedDurationDays: 14,
          matterId: matter.id
        }
      }));

    const matterSteps = [
      {
        groupId: intake.id,
        label: "Engagement letter signed",
        completed: true,
        sortOrder: 1,
        indentLevel: 0
      },
      {
        groupId: intake.id,
        label: "Initial fact collection",
        completed: true,
        sortOrder: 2,
        indentLevel: 1
      },
      {
        groupId: strategy.id,
        label: "Risk matrix drafted",
        completed: matter.title !== "Vendor Contract Breach Review",
        sortOrder: 3,
        indentLevel: 0
      },
      {
        groupId: strategy.id,
        label: "Client alignment call",
        completed: matter.title === "Trademark Portfolio Expansion",
        sortOrder: 4,
        indentLevel: 1
      }
    ];

    for (const step of matterSteps) {
      const existingStep = await prisma.checklistStep.findFirst({
        where: {
          matterId: matter.id,
          label: step.label
        }
      });

      if (existingStep) {
        continue;
      }

      await prisma.checklistStep.create({
        data: {
          matterId: matter.id,
          ...step,
          completedAt: step.completed ? new Date() : null
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
