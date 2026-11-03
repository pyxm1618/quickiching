import { z } from "zod";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { clearThreeCoinReading } from "@/lib/three-coin-session";
import { clearPublicReadingSession } from "@/lib/public-reading-session";
import { LEGACY_MEI_HUA_METHOD_VERSION, PUBLIC_METHOD_VERSIONS, type PublicReadingMethod, type PublicReading } from "@/domain/public-reading/types";

export const COMPLETED_PUBLIC_READING_STORAGE_KEY = "quickiching:public-v1:completed-reading";

const completedSchema = z.object({
  schemaVersion: z.literal(1), id: z.string().uuid(), createdAt: z.string().datetime(),
  method: z.enum(["three-coin", "yarrow-stalks", "mei-hua-yi-shu"]), methodVersion: z.string().max(80),
  question: z.string().max(1000).optional(),
  lineValuesBottomUp: z.array(z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)])).length(6),
  evidence: z.object({ kind: z.enum(["three-coin", "yarrow-stalks", "mei-hua-yi-shu"]) }).passthrough(),
});

export function completedPublicReadingPath(id: string, zh = false): string {
  return `${zh ? "/zh" : ""}/readings/result?session=${encodeURIComponent(id)}`;
}

export function writeCompletedPublicReading(reading: PublicReading): void {
  window.sessionStorage.setItem(COMPLETED_PUBLIC_READING_STORAGE_KEY, JSON.stringify(reading));
}

export function readCompletedPublicReading(sessionId?: string | null): PublicReading | null {
  try {
    const raw = window.sessionStorage.getItem(COMPLETED_PUBLIC_READING_STORAGE_KEY);
    if (!raw || raw.length > 16 * 1024) return null;
    const parsed = completedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || (sessionId && parsed.data.id !== sessionId)) return null;
    const reading = buildPublicReading({ ...parsed.data, evidence: parsed.data.evidence as PublicReading["evidence"] });
    // Validate the source evidence needed by the common persistence gate, too.
    publicReadingSaveInput(reading);
    return reading;
  } catch { return null; }
}

export function publicReadingSaveInput(reading: PublicReading) {
  const method = reading.method === "three-coin"
    ? "three_coin"
    : reading.method === "yarrow-stalks"
      ? "yarrow_stalk"
      : reading.method === "mei-hua-yi-shu"
        ? "mei_hua_number_time"
        : null;
  if (!method) throw new Error("UNSUPPORTED_READING_METHOD");
  if (reading.method === "mei-hua-yi-shu") {
    if (reading.methodVersion === LEGACY_MEI_HUA_METHOD_VERSION) throw new Error("LEGACY_MEI_HUA_READ_ONLY");
    if (reading.methodVersion !== PUBLIC_METHOD_VERSIONS["mei-hua-yi-shu"]) throw new Error("UNSUPPORTED_MEI_HUA_VERSION");
  }
  let methodCalculation: Record<string, unknown> | undefined;
  if (reading.evidence.kind === "yarrow-stalks") {
    if (!Array.isArray(reading.evidence.lines) || reading.evidence.lines.length !== 6) throw new Error("INVALID_YARROW_EVIDENCE");
    methodCalculation = { changes: reading.evidence.lines.flatMap(line => line.changes) };
  } else if (reading.evidence.kind === "mei-hua-yi-shu") {
    const source = reading.evidence.calculation.methodCalculation;
    if (!Number.isSafeInteger(source.number) || Number(source.number) <= 0
      || !Number.isSafeInteger(source.utcMillis) || typeof source.ianaTimeZone !== "string") throw new Error("INVALID_MEI_HUA_EVIDENCE");
    methodCalculation = { number: Number(source.number), utcMillis: Number(source.utcMillis), ianaTimeZone: source.ianaTimeZone };
  } else if (method !== "three_coin") throw new Error("READING_METHOD_EVIDENCE_REQUIRED");
  return { clientCastingId: reading.id, method, algorithmVersion: reading.methodVersion, lineValuesBottomUp: reading.lineValuesBottomUp, question: reading.question, ...(methodCalculation ? { methodCalculation } : {}) };
}

// Explicit per-method targets: restarting one cast must not clear unrelated sessions.
export function clearCompletedReadingForRestart(method: PublicReadingMethod, zh = false): string {
  if (method === "three-coin") clearThreeCoinReading();
  else if (method === "yarrow-stalks") clearPublicReadingSession("quickiching:public-v1:yarrow-v2");
  else if (method === "mei-hua-yi-shu") clearPublicReadingSession("quickiching:public-v1:mei-hua-number-time-v1");
  window.sessionStorage.removeItem(COMPLETED_PUBLIC_READING_STORAGE_KEY);
  const slug = method === "three-coin" ? "three-coin" : method === "yarrow-stalks" ? "yarrow-stalks" : method === "mei-hua-yi-shu" ? "mei-hua-yi-shu" : "manual-cast";
  return `${zh ? "/zh" : ""}/methods/${slug}`;
}
