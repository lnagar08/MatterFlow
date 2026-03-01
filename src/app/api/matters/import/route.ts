import { NextResponse } from "next/server";

import { requireFirmMembership } from "@/lib/firm-access";
import { parseGroupProgress } from "@/lib/group-progress";
import { prisma } from "@/lib/prisma";

type ImportRowPayload = {
  matterTitle?: string;
  matterSummary?: string;
  clientName?: string;
  clientEmail?: string;
  engagementDate?: string;
  dueDate?: string;
  amountPaid?: number | null;
  templateName?: string;
};

type ImportPayload = {
  rows?: ImportRowPayload[];
};
type FailedRow = { index: number; message: string };
type ImportWarning = { row: number; message: string };
type NormalizedRow = {
  matterTitle: string;
  clientName: string;
  templateName: string | null;
  matterSummary: string;
  engagementDate: string | null;
  dueDate: string | null;
  amountPaid: number | null;
};
type InvalidRow = { rowNumber: number; message: string; normalizedRow: NormalizedRow };
type DuplicateRow = { rowNumber: number; message: string; normalizedRow: NormalizedRow };

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,;:'"()[\]{}!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,;:'"()[\]{}!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseDateToISO(value: string | undefined) {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : raw;
  }

  const mmdd = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmdd) {
    const [, m, d, y] = mmdd;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    const parsed = new Date(`${iso}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : iso;
  }

  return null;
}

function normalizeMoney(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

async function applyTemplateToMatter(args: { matterId: string; firmId: string; templateName: string }) {
  const template = await prisma.matterTemplate.findFirst({
    where: {
      firmId: args.firmId,
      name: args.templateName
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

  if (!template) {
    return { applied: false };
  }

  const groupMap = new Map<string, string>();
  const orderedGroups: Array<{ id: string; sortOrder: number }> = [];
  for (const group of template.groups) {
    const createdGroup = await prisma.checklistGroup.create({
      data: {
        matterId: args.matterId,
        title: group.title,
        sortOrder: group.sortOrder,
        indentLevel: group.indentLevel,
        expectedDurationDays: group.expectedDurationDays
      }
    });
    groupMap.set(group.id, createdGroup.id);
    orderedGroups.push({ id: createdGroup.id, sortOrder: createdGroup.sortOrder });
  }

  for (const step of template.steps) {
    await prisma.checklistStep.create({
      data: {
        matterId: args.matterId,
        groupId: step.groupId ? (groupMap.get(step.groupId) ?? null) : null,
        label: step.label,
        sortOrder: step.sortOrder,
        indentLevel: step.indentLevel,
        dueDaysOffset: step.defaultDueDaysOffset,
        completed: false
      }
    });
  }

  const firstGroup = orderedGroups.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (firstGroup) {
    const matter = await prisma.matter.findUnique({
      where: { id: args.matterId },
      select: { engagementDate: true, groupProgress: true }
    });
    const progress = parseGroupProgress(matter?.groupProgress);
    const start = matter?.engagementDate && matter.engagementDate < new Date() ? matter.engagementDate : new Date();
    progress[firstGroup.id] = { startedAt: start.toISOString() };
    await prisma.matter.update({
      where: { id: args.matterId },
      data: { groupProgress: progress }
    });
  }

  return { applied: true };
}

export async function POST(request: Request) {
  try {
    const { membership } = await requireFirmMembership();
    const payload = (await request.json()) as ImportPayload;
    const rows = payload.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided." }, { status: 400 });
    }

    let imported = 0;
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    let createdClients = 0;
    let reusedClients = 0;
    const failed: FailedRow[] = [];
    const warnings: ImportWarning[] = [];
    const invalidRows: InvalidRow[] = [];
    const duplicateRows: DuplicateRow[] = [];

    const existingClients = await prisma.client.findMany({
      where: { firmId: membership.firmId },
      select: { id: true, name: true }
    });
    const clientByName = new Map<string, string>();
    for (const client of existingClients) {
      const key = normalizeName(client.name);
      if (key && !clientByName.has(key)) {
        clientByName.set(key, client.id);
      }
    }
    const batchClientByName = new Map<string, string>();
    const batchClientByEmail = new Map<string, string>();

    const existingMatters = await prisma.matter.findMany({
      where: {
        firmId: membership.firmId,
        archivedAt: null
      },
      select: {
        id: true,
        clientId: true,
        title: true
      }
    });
    const matterKeySet = new Set<string>();
    for (const matter of existingMatters) {
      matterKeySet.add(`${matter.clientId}::${normalizeTitle(matter.title)}`);
    }

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const row = rows[index];

      const matterTitle = row.matterTitle?.trim() ?? "";
      const clientName = row.clientName?.trim() ?? "";
      const clientEmail = row.clientEmail?.trim() ?? "";
      const matterSummary = row.matterSummary?.trim() || "Imported via CSV.";
      const templateName = row.templateName?.trim() || "";
      const engagementDateIso = parseDateToISO(row.engagementDate);
      const dueDateIso = parseDateToISO(row.dueDate);
      const normalizedRow: NormalizedRow = {
        matterTitle,
        clientName,
        templateName: templateName || null,
        matterSummary,
        engagementDate: engagementDateIso,
        dueDate: dueDateIso,
        amountPaid: row.amountPaid ?? null
      };

      if (!matterTitle || !clientName) {
        skippedInvalid += 1;
        const message = "Missing required fields: matterTitle and clientName are required.";
        failed.push({ index: rowNumber, message });
        invalidRows.push({ rowNumber, message, normalizedRow });
        continue;
      }

      if (row.engagementDate && !engagementDateIso) {
        skippedInvalid += 1;
        const message = "Invalid engagementDate format. Use YYYY-MM-DD or MM/DD/YYYY.";
        failed.push({ index: rowNumber, message });
        invalidRows.push({ rowNumber, message, normalizedRow });
        continue;
      }

      if (row.dueDate && !dueDateIso) {
        skippedInvalid += 1;
        const message = "Invalid dueDate format. Use YYYY-MM-DD or MM/DD/YYYY.";
        failed.push({ index: rowNumber, message });
        invalidRows.push({ rowNumber, message, normalizedRow });
        continue;
      }

      if (row.amountPaid !== null && row.amountPaid !== undefined && (Number.isNaN(Number(row.amountPaid)) || Number(row.amountPaid) < 0)) {
        skippedInvalid += 1;
        const message = "Invalid amountPaid. Must be a number >= 0.";
        failed.push({ index: rowNumber, message });
        invalidRows.push({ rowNumber, message, normalizedRow });
        continue;
      }

      const engagementDate = engagementDateIso ? new Date(`${engagementDateIso}T00:00:00`) : new Date();
      const dueDate = dueDateIso ? new Date(`${dueDateIso}T00:00:00`) : engagementDate;

      try {
        const normalizedClientName = normalizeName(clientName);
        const normalizedClientEmail = clientEmail ? normalizeEmail(clientEmail) : "";
        let clientId: string | null = null;

        if (normalizedClientEmail && batchClientByEmail.has(normalizedClientEmail)) {
          clientId = batchClientByEmail.get(normalizedClientEmail) ?? null;
        }
        if (!clientId && normalizedClientName && batchClientByName.has(normalizedClientName)) {
          clientId = batchClientByName.get(normalizedClientName) ?? null;
        }
        if (!clientId && normalizedClientName && clientByName.has(normalizedClientName)) {
          clientId = clientByName.get(normalizedClientName) ?? null;
          if (clientId) {
            reusedClients += 1;
          }
        }

        if (!clientId) {
          const client = await prisma.client.create({
            data: {
              firmId: membership.firmId,
              name: clientName,
              companyName: clientName,
              logoUrl:
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=120&q=80"
            },
            select: { id: true }
          });
          clientId = client.id;
          createdClients += 1;
        }

        if (normalizedClientName) {
          batchClientByName.set(normalizedClientName, clientId);
          clientByName.set(normalizedClientName, clientId);
        }
        if (normalizedClientEmail) {
          batchClientByEmail.set(normalizedClientEmail, clientId);
        }

        const matterKey = `${clientId}::${normalizeTitle(matterTitle)}`;
        if (matterKeySet.has(matterKey)) {
          skippedDuplicate += 1;
          const message = "Duplicate matter (same client + title) already exists.";
          duplicateRows.push({ rowNumber, message, normalizedRow });
          continue;
        }

        const matter = await prisma.matter.create({
          data: {
            title: matterTitle,
            blurb: matterSummary,
            clientId,
            firmId: membership.firmId,
            engagementDate,
            dueDate,
            amountPaid: normalizeMoney(row.amountPaid),
            lastActivityAt: new Date(),
            groupProgress: {}
          }
        });

        matterKeySet.add(matterKey);

        if (templateName) {
          const result = await applyTemplateToMatter({
            matterId: matter.id,
            firmId: membership.firmId,
            templateName
          });
          if (!result.applied) {
            warnings.push({
              row: rowNumber,
              message: `Template "${templateName}" was not found and was skipped.`
            });
          }
        }

        imported += 1;
      } catch (error) {
        skippedInvalid += 1;
        const message = error instanceof Error ? error.message : "Failed to import row.";
        failed.push({ index: rowNumber, message });
        invalidRows.push({ rowNumber, message, normalizedRow });
      }
    }

    return NextResponse.json({
      imported,
      skippedInvalid,
      skippedDuplicate,
      createdClients,
      reusedClients,
      failed,
      invalidRows,
      duplicateRows,
      warnings
    });
  } catch (error) {
    return NextResponse.json({
      imported: 0,
      skippedInvalid: 0,
      skippedDuplicate: 0,
      createdClients: 0,
      reusedClients: 0,
      failed: [{ index: 0, message: error instanceof Error ? error.message : "Import failed." }],
      invalidRows: [],
      duplicateRows: [],
      warnings: []
    });
  }
}
