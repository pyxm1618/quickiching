export const PUBLIC_QUESTION_MAX_CODE_POINTS = 500;

export function normalizePublicQuestion(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const normalized = value.trim();
  if (normalized.length === 0) return undefined;
  if (Array.from(normalized).length > PUBLIC_QUESTION_MAX_CODE_POINTS) {
    throw new Error("PUBLIC_QUESTION_TOO_LONG");
  }
  return normalized;
}
