import { z } from "zod";
import { buildPublicReading } from "@/domain/public-reading/reading";
import {
  PUBLIC_METHOD_VERSIONS,
  type PublicReading,
  type PublicReadingMethod,
} from "@/domain/public-reading/types";

/**
 * C4 — Universal Pending Completed Reading.
 *
 * This is the single authoritative store for a completed-but-not-yet-durable
 * cast. It is exact-identity keyed: one localStorage record per readingId.
 * There is no singleton, no `latest()`, no `first()` and no guessing.
 */
export const PENDING_COMPLETED_READING_KEY_PREFIX = "quickiching:public-v1:pending-completed-reading:";
export const PENDING_COMPLETED_READING_SCHEMA_VERSION = 1 as const;
export const PENDING_COMPLETED_READING_TTL_MS = 60 * 60 * 1000;

export const PENDING_COMPLETED_READING_UNAVAILABLE = "PENDING_COMPLETED_READING_UNAVAILABLE";
export const PENDING_COMPLETED_READING_WRITE_FAILED = "PENDING_COMPLETED_READING_WRITE_FAILED";
export const PENDING_COMPLETED_READING_REMOVE_FAILED = "PENDING_COMPLETED_READING_REMOVE_FAILED";

const METHOD_VALUES = ["three-coin", "yarrow-stalks", "mei-hua-yi-shu", "manual"] as const;

const manualEvidenceSchema = z.discriminatedUnion("mode", [
  z.object({ kind: z.literal("manual"), mode: z.literal("line-values") }).strict(),
  z
    .object({
      kind: z.literal("manual"),
      mode: z.literal("primary-changing"),
      primaryHexagramNumber: z.number().int().min(1).max(64),
      changingLines: z
        .array(z.number().int().min(1).max(6))
        .max(6)
        .refine((lines) => new Set(lines).size === lines.length, "MANUAL_DUPLICATE_CHANGING_LINE"),
    })
    .strict(),
]);

const pendingSchema = z
  .object({
    schemaVersion: z.literal(PENDING_COMPLETED_READING_SCHEMA_VERSION),
    readingId: z.string().min(1),
    method: z.enum(METHOD_VALUES),
    methodVersion: z.string().max(80),
    question: z.string().max(1000).optional(),
    lineValuesBottomUp: z
      .array(z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]))
      .length(6),
    evidence: z.union([
      z.object({ kind: z.enum(["three-coin", "yarrow-stalks", "mei-hua-yi-shu"]) }).passthrough(),
      manualEvidenceSchema,
    ]),
    createdAt: z.string().datetime(),
    pendingCreatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type PendingCompletedReadingRecord = z.infer<typeof pendingSchema>;

export function pendingCompletedReadingStorageKey(readingId: string): string {
  return `${PENDING_COMPLETED_READING_KEY_PREFIX}${readingId}`;
}

function pendingStorage(): Storage {
  try {
    if (typeof window === "undefined" || !window.localStorage) throw new Error(PENDING_COMPLETED_READING_UNAVAILABLE);
    return window.localStorage;
  } catch {
    throw new Error(PENDING_COMPLETED_READING_UNAVAILABLE);
  }
}

function removeQuietly(key: string): void {
  try {
    pendingStorage().removeItem(key);
  } catch {
    // Expired cleanup must never block the current read.
  }
}

/**
 * Writes the minimum facts required to rebuild the exact completed reading.
 * `readingId` is the identity. It is never re-minted here.
 */
export function writePendingCompletedReading(
  reading: PublicReading,
  now: number = Date.now(),
): PendingCompletedReadingRecord {
  if (reading.methodVersion !== PUBLIC_METHOD_VERSIONS[reading.method]) {
    throw new Error("UNSUPPORTED_READING_METHOD_VERSION");
  }

  const record: PendingCompletedReadingRecord = {
    schemaVersion: PENDING_COMPLETED_READING_SCHEMA_VERSION,
    readingId: reading.id,
    method: reading.method,
    methodVersion: reading.methodVersion,
    ...(reading.question ? { question: reading.question } : {}),
    lineValuesBottomUp: [...reading.lineValuesBottomUp],
    evidence: reading.evidence as PendingCompletedReadingRecord["evidence"],
    createdAt: reading.createdAt,
    pendingCreatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PENDING_COMPLETED_READING_TTL_MS).toISOString(),
  };

  const serialized = JSON.stringify(record);
  if (serialized.length > 16 * 1024) throw new Error(PENDING_COMPLETED_READING_WRITE_FAILED);

  try {
    pendingStorage().setItem(pendingCompletedReadingStorageKey(reading.id), serialized);
  } catch (error) {
    if (error instanceof Error && error.message === PENDING_COMPLETED_READING_UNAVAILABLE) {
      throw new Error(PENDING_COMPLETED_READING_WRITE_FAILED);
    }
    throw new Error(PENDING_COMPLETED_READING_WRITE_FAILED);
  }
  return record;
}

/**
 * Reads exactly one pending reading. A missing/blank readingId fails closed;
 * it never falls back to another stored reading.
 */
export function readPendingCompletedReading(
  readingId: string | null | undefined,
  now: number = Date.now(),
): PublicReading | null {
  const id = typeof readingId === "string" ? readingId.trim() : "";
  if (!id) return null;

  const key = pendingCompletedReadingStorageKey(id);
  let raw: string | null = null;
  try {
    raw = pendingStorage().getItem(key);
  } catch {
    return null;
  }
  if (!raw || raw.length > 16 * 1024) return null;

  let record: PendingCompletedReadingRecord;
  try {
    const parsed = pendingSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    record = parsed.data;
  } catch {
    return null;
  }

  if (record.readingId !== id) return null;
  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    removeQuietly(key);
    return null;
  }
  if (record.methodVersion !== PUBLIC_METHOD_VERSIONS[record.method]) return null;

  try {
    const reading = buildPublicReading({
      id: record.readingId,
      createdAt: record.createdAt,
      method: record.method,
      methodVersion: record.methodVersion,
      question: record.question,
      lineValuesBottomUp: record.lineValuesBottomUp,
      evidence: record.evidence as PublicReading["evidence"],
    });
    return reading.id === id ? reading : null;
  } catch {
    return null;
  }
}

export function removePendingCompletedReading(readingId: string | null | undefined): void {
  const id = typeof readingId === "string" ? readingId.trim() : "";
  if (!id) return;
  try {
    pendingStorage().removeItem(pendingCompletedReadingStorageKey(id));
  } catch (error) {
    if (error instanceof Error && error.message === PENDING_COMPLETED_READING_UNAVAILABLE) {
      throw new Error(PENDING_COMPLETED_READING_REMOVE_FAILED);
    }
    throw new Error(PENDING_COMPLETED_READING_REMOVE_FAILED);
  }
}

export function listPendingCompletedReadingIds(): string[] {
  let storage: Storage;
  try {
    storage = pendingStorage();
  } catch {
    return [];
  }
  const ids: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(PENDING_COMPLETED_READING_KEY_PREFIX)) {
        ids.push(key.slice(PENDING_COMPLETED_READING_KEY_PREFIX.length));
      }
    }
  } catch {
    return [];
  }
  return ids;
}

/** Removes only expired pending records. Never touches a live reading. */
export function purgeExpiredPendingCompletedReadings(now: number = Date.now()): number {
  let removed = 0;
  for (const id of listPendingCompletedReadingIds()) {
    const key = pendingCompletedReadingStorageKey(id);
    try {
      const raw = pendingStorage().getItem(key);
      if (!raw) continue;
      const parsed = pendingSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        removeQuietly(key);
        removed += 1;
        continue;
      }
      if (Date.parse(parsed.data.expiresAt) <= now) {
        removeQuietly(key);
        removed += 1;
      }
    } catch {
      // A malformed record is not authoritative; leave it for the TTL sweep.
    }
  }
  return removed;
}

export function isPendingCompletedReadingMethod(value: string): value is PublicReadingMethod {
  return (METHOD_VALUES as readonly string[]).includes(value);
}
