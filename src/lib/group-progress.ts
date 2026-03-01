export type GroupProgressMap = Record<string, { startedAt: string }>;

export function parseGroupProgress(value: unknown): GroupProgressMap {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const result: GroupProgressMap = {};
  for (const [key, raw] of Object.entries(source)) {
    if (!raw || typeof raw !== "object") continue;
    const startedAt = (raw as Record<string, unknown>).startedAt;
    if (typeof startedAt !== "string") continue;
    const date = new Date(startedAt);
    if (Number.isNaN(date.getTime())) continue;
    result[key] = { startedAt: date.toISOString() };
  }
  return result;
}

export function getGroupProgressStart(
  progress: GroupProgressMap,
  groupId: string,
  fallback: Date
) {
  const raw = progress[groupId]?.startedAt;
  if (!raw) return fallback;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

