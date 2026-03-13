import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { getCurrentUserContext } from "@/lib/firm-access";
import { buildGroupProgressPayload, parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ matterId: string }>;
};

type Payload = {
  templateId?: string;
};

export async function POST(request: Request, { params }: Params) {
  const context = await getCurrentUserContext();
  if (!context?.membership) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { matterId } = await params;
  const payload = (await request.json()) as Payload;
  const templateId = payload.templateId?.trim();

  if (!templateId) {
    return NextResponse.json({ error: "templateId is required." }, { status: 400 });
  }

  const [matter, template] = await Promise.all([
    prisma.matter.findFirst({
      where: {
        id: matterId,
        firmId: context.membership.firmId,
        archivedAt: null
      }
    }),
    prisma.matterTemplate.findFirst({
      where: {
        id: templateId,
        firmId: context.membership.firmId
      },
      include: {
        groups: {
          orderBy: {
            sortOrder: "asc"
          }
        },
        steps: {
          orderBy: {
            sortOrder: "asc"
          }
        }
      }
    })
  ]);

  if (!matter) {
    return NextResponse.json({ error: "Matter not found." }, { status: 404 });
  }

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.checklistStep.deleteMany({
      where: {
        matterId: matter.id
      }
    });

    await tx.checklistGroup.deleteMany({
      where: {
        matterId: matter.id
      }
    });

    const groupMap = new Map<string, string>();
    const orderedCreatedGroups: Array<{ id: string; sortOrder: number }> = [];

    for (const group of template.groups) {
      const created = await tx.checklistGroup.create({
        data: {
          matterId: matter.id,
          title: group.title,
          sortOrder: group.sortOrder,
          indentLevel: group.indentLevel,
          expectedDurationDays: group.expectedDurationDays
        }
      });

      groupMap.set(group.id, created.id);
      orderedCreatedGroups.push({ id: created.id, sortOrder: created.sortOrder });
    }

    for (const step of template.steps) {
      await tx.checklistStep.create({
        data: {
          matterId: matter.id,
          groupId: step.groupId ? (groupMap.get(step.groupId) ?? null) : null,
          label: step.label,
          sortOrder: step.sortOrder,
          indentLevel: step.indentLevel,
          dueDaysOffset: step.defaultDueDaysOffset,
          completed: false
        }
      });
    }

    const firstGroup = orderedCreatedGroups.sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const groupProgress = parseGroupProgress(matter.groupProgress);
    if (firstGroup) {
      groupProgress[firstGroup.id] = { startedAt: new Date().toISOString() };
    }

    await tx.matter.update({
      where: { id: matter.id },
      data: {
        lastActivityAt: new Date(),
        groupProgress: buildGroupProgressPayload(groupProgress, {
          templateId: template.id,
          existingRaw: matter.groupProgress
        }) as Prisma.InputJsonValue
      }
    });
  });

  revalidatePath(`/matters/${matter.id}`);
  revalidatePath("/home");
  revalidatePath("/matters");
  revalidatePath("/penalty-box");

  return NextResponse.json({ ok: true });
}
