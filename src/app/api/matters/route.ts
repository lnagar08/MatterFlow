import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth"; 
import { authOptions } from "@/lib/auth";
import { requireFirmMembership } from "@/lib/firm-access";
import { buildGroupProgressPayload, parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";

type CreateMatterPayload = {
  title?: string;
  blurb?: string;
  clientId?: string | null;
  newClient?: {
    name?: string;
    companyName?: string;
    logoUrl?: string | null;
  } | null;
  engagementDate?: string;
  amountPaid?: number;
  dueDate?: string;
  templateId?: string | null;
};
type iSession = {
  user: {
    id:string;
  }
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as iSession;
  if (!session || !session.user) {
	  return NextResponse.json({ error: "Unauthorized" }, { status: 400 });
  }
  
  const { membership } = await requireFirmMembership();
  const payload = (await request.json()) as CreateMatterPayload;

  const title = payload.title?.trim();
  const blurb = payload.blurb?.trim();
  const clientId = payload.clientId?.trim() || null;
  const engagementDate = payload.engagementDate ? new Date(payload.engagementDate) : null;
  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  const amountPaid = Number(payload.amountPaid ?? 0);
  const templateId = payload.templateId?.trim() || null;

  if (!title || !blurb || !engagementDate || !dueDate || Number.isNaN(amountPaid)) {
    return NextResponse.json({ error: "Missing required matter fields." }, { status: 400 });
  }

  let resolvedClientId = clientId;

  if (!resolvedClientId && payload.newClient) {
    const newName = payload.newClient.name?.trim();
    const newCompanyName = payload.newClient.companyName?.trim();
    const newLogoUrl = payload.newClient.logoUrl?.trim();

    if (!newName || !newCompanyName) {
      return NextResponse.json(
        { error: "New client name and company are required." },
        { status: 400 }
      );
    }

    const createdClient = await prisma.client.create({
      data: {
        firmId: membership.firmId,
        userId: session.user.id,
        name: newName,
        companyName: newCompanyName,
        logoUrl:
          newLogoUrl ||
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&q=80"
      }
    });
    resolvedClientId = createdClient.id;
  }

  if (!resolvedClientId) {
    return NextResponse.json({ error: "Select an existing client or create a new one." }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: {
      id: resolvedClientId,
      firmId: membership.firmId
    }
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const matter = await prisma.matter.create({
    data: {
      title,
      blurb,
	    userId: session.user.id,
      clientId: resolvedClientId,
      firmId: membership.firmId,
      engagementDate,
      amountPaid,
      dueDate,
      lastActivityAt: new Date(),
      groupProgress: {}
    }
  });

  if (templateId) {
    const template = await prisma.matterTemplate.findFirst({
      where: {
        id: templateId,
        firmId: membership.firmId
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
    });

    if (template) {
      const groupMap = new Map<string, string>();

      const orderedCreatedGroups: Array<{ id: string; sortOrder: number }> = [];
      for (const group of template.groups) {
        const createdGroup = await prisma.checklistGroup.create({
          data: {
            matterId: matter.id,
            title: group.title,
            sortOrder: group.sortOrder,
            indentLevel: group.indentLevel,
            expectedDurationDays: group.expectedDurationDays
          }
        });
        groupMap.set(group.id, createdGroup.id);
        orderedCreatedGroups.push({ id: createdGroup.id, sortOrder: createdGroup.sortOrder });
      }

      for (const step of template.steps) {
        await prisma.checklistStep.create({
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
      if (firstGroup) {
        const groupProgress = parseGroupProgress(matter.groupProgress);
        groupProgress[firstGroup.id] = { startedAt: new Date().toISOString() };
        await prisma.matter.update({
          where: { id: matter.id },
          data: {
            groupProgress: buildGroupProgressPayload(groupProgress, {
              templateId: template.id,
              existingRaw: matter.groupProgress
            }) as Prisma.InputJsonValue
          }
        });
      }
    }
  }

  return NextResponse.json({ matterId: matter.id });
}
