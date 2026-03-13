export type GroupProgressMap = Record<string, { startedAt: string }>;
const TEMPLATE_LINK_KEY = "__templateLink";

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
  fallback: Date,
  upperBound?: Date
) {
  const raw = progress[groupId]?.startedAt;
  const upper = upperBound && !Number.isNaN(upperBound.getTime()) ? upperBound : null;
  const boundedFallback = upper && fallback.getTime() > upper.getTime() ? upper : fallback;
  if (!raw) {
    return boundedFallback;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return boundedFallback;
  }
  // Clamp persisted stage start into a sensible window:
  // - not earlier than computed baseline (fallback)
  // - not later than known completion evidence in this stage (upperBound)
  const lowerBound = fallback.getTime();
  const upperBoundMs = upper?.getTime();
  if (date.getTime() < lowerBound) {
    return boundedFallback;
  }
  if (typeof upperBoundMs === "number" && date.getTime() > upperBoundMs) {
    return new Date(upperBoundMs);
  }
  return date;
}

export function getTemplateLink(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const raw = source[TEMPLATE_LINK_KEY];
  if (!raw || typeof raw !== "object") return null;
  const templateId = (raw as Record<string, unknown>).templateId;
  return typeof templateId === "string" && templateId.trim() ? templateId.trim() : null;
}

export function buildGroupProgressPayload(
  progress: GroupProgressMap,
  options?: { templateId?: string | null; existingRaw?: unknown }
) {
  const base: Record<string, unknown> =
    options?.existingRaw && typeof options.existingRaw === "object" && !Array.isArray(options.existingRaw)
      ? { ...(options.existingRaw as Record<string, unknown>) }
      : {};

  for (const [groupId, value] of Object.entries(progress)) {
    base[groupId] = { startedAt: value.startedAt };
  }

  if (options?.templateId) {
    base[TEMPLATE_LINK_KEY] = { templateId: options.templateId };
  }

  return base;
}
