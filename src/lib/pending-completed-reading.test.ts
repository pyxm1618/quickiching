import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { PUBLIC_METHOD_VERSIONS, type PublicReading } from "@/domain/public-reading/types";
import {
  PENDING_COMPLETED_READING_KEY_PREFIX,
  PENDING_COMPLETED_READING_TTL_MS,
  PENDING_COMPLETED_READING_WRITE_FAILED,
  listPendingCompletedReadingIds,
  pendingCompletedReadingStorageKey,
  purgeExpiredPendingCompletedReadings,
  readPendingCompletedReading,
  removePendingCompletedReading,
  writePendingCompletedReading,
} from "./pending-completed-reading";

const ID_A = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";
const ID_B = "5e1b2c3d-4a5f-4a6b-8c7d-9e0f1a2b3c4d";

function manualReading(id: string, lines: [number, number, number, number, number, number] = [7, 8, 9, 6, 7, 8], question?: string): PublicReading {
  return buildPublicReading({
    id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 9, 30)).toISOString(),
    method: "manual",
    question,
    lineValuesBottomUp: lines,
    evidence: { kind: "manual", mode: "line-values" },
  });
}

function stubLocalStorage() {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
    removeItem: (key: string) => { memory.delete(key); },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() { return memory.size; },
  } as Storage;
  vi.stubGlobal("window", { localStorage: storage });
  return { memory, storage };
}

afterEach(() => vi.unstubAllGlobals());

describe("C4 — Pending Completed Reading store", () => {
  it("keys records by exact readingId and never uses a singleton", () => {
    const { memory } = stubLocalStorage();
    writePendingCompletedReading(manualReading(ID_A));
    expect([...memory.keys()]).toEqual([`${PENDING_COMPLETED_READING_KEY_PREFIX}${ID_A}`]);
    expect(pendingCompletedReadingStorageKey(ID_A)).toBe(`${PENDING_COMPLETED_READING_KEY_PREFIX}${ID_A}`);
  });

  it("stores only the minimum completion facts", () => {
    const { memory } = stubLocalStorage();
    writePendingCompletedReading(manualReading(ID_A, [7, 8, 9, 6, 7, 8], "Should I move?"));
    const raw = JSON.parse(memory.get(pendingCompletedReadingStorageKey(ID_A)) ?? "null") as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual([
      "createdAt",
      "evidence",
      "expiresAt",
      "lineValuesBottomUp",
      "method",
      "methodVersion",
      "pendingCreatedAt",
      "question",
      "readingId",
      "schemaVersion",
    ]);
    expect(raw).not.toHaveProperty("prose");
    expect(raw).not.toHaveProperty("credits");
    expect(raw).not.toHaveProperty("account");
    expect(raw).not.toHaveProperty("entitlements");
    expect(raw).not.toHaveProperty("payment");
  });

  it("round-trips the exact reading including method evidence", () => {
    stubLocalStorage();
    const reading = manualReading(ID_A, [9, 9, 9, 6, 6, 6], "Should I stay?");
    writePendingCompletedReading(reading);
    expect(readPendingCompletedReading(ID_A)).toEqual(reading);
  });

  it("keeps A and B coexisting and reads each by exact id", () => {
    stubLocalStorage();
    const a = manualReading(ID_A, [7, 7, 7, 7, 7, 7]);
    const b = manualReading(ID_B, [8, 8, 8, 8, 8, 8]);
    writePendingCompletedReading(a);
    writePendingCompletedReading(b);
    expect(readPendingCompletedReading(ID_A)?.id).toBe(ID_A);
    expect(readPendingCompletedReading(ID_B)?.id).toBe(ID_B);
    expect(readPendingCompletedReading(ID_A)?.lineValuesBottomUp).toEqual([7, 7, 7, 7, 7, 7]);
    expect(readPendingCompletedReading(ID_B)?.lineValuesBottomUp).toEqual([8, 8, 8, 8, 8, 8]);
  });

  it("fails closed for a missing, blank or unknown session", () => {
    stubLocalStorage();
    writePendingCompletedReading(manualReading(ID_B));
    expect(readPendingCompletedReading(undefined)).toBeNull();
    expect(readPendingCompletedReading(null)).toBeNull();
    expect(readPendingCompletedReading("   ")).toBeNull();
    expect(readPendingCompletedReading(ID_A)).toBeNull();
  });

  it("expires a record after the 60 minute TTL and removes it", () => {
    const { memory } = stubLocalStorage();
    const now = Date.UTC(2026, 10, 14, 9, 30);
    writePendingCompletedReading(manualReading(ID_A), now);
    expect(readPendingCompletedReading(ID_A, now + PENDING_COMPLETED_READING_TTL_MS - 1)).not.toBeNull();
    expect(readPendingCompletedReading(ID_A, now + PENDING_COMPLETED_READING_TTL_MS)).toBeNull();
    expect(memory.has(pendingCompletedReadingStorageKey(ID_A))).toBe(false);
  });

  it("purges only expired records and leaves live readings intact", () => {
    const { memory } = stubLocalStorage();
    const now = Date.UTC(2026, 10, 14, 9, 30);
    writePendingCompletedReading(manualReading(ID_A), now - PENDING_COMPLETED_READING_TTL_MS - 1);
    writePendingCompletedReading(manualReading(ID_B), now);
    expect(purgeExpiredPendingCompletedReadings(now)).toBe(1);
    expect(memory.has(pendingCompletedReadingStorageKey(ID_A))).toBe(false);
    expect(memory.has(pendingCompletedReadingStorageKey(ID_B))).toBe(true);
    expect(listPendingCompletedReadingIds()).toEqual([ID_B]);
  });

  it("removes exactly one reading", () => {
    stubLocalStorage();
    writePendingCompletedReading(manualReading(ID_A));
    writePendingCompletedReading(manualReading(ID_B));
    removePendingCompletedReading(ID_A);
    expect(readPendingCompletedReading(ID_A)).toBeNull();
    expect(readPendingCompletedReading(ID_B)).not.toBeNull();
    expect(() => removePendingCompletedReading(undefined)).not.toThrow();
  });

  it("fails closed on corrupt or tampered records", () => {
    const { memory } = stubLocalStorage();
    memory.set(pendingCompletedReadingStorageKey(ID_A), "{broken");
    expect(readPendingCompletedReading(ID_A)).toBeNull();

    const record = writePendingCompletedReading(manualReading(ID_A));
    memory.set(pendingCompletedReadingStorageKey(ID_A), JSON.stringify({ ...record, readingId: ID_B }));
    expect(readPendingCompletedReading(ID_A)).toBeNull();
  });

  it("rejects an unsupported method version instead of displaying it", () => {
    const { memory } = stubLocalStorage();
    const record = writePendingCompletedReading(manualReading(ID_A));
    memory.set(pendingCompletedReadingStorageKey(ID_A), JSON.stringify({
      ...record,
      methodVersion: "manual-cast-v0",
    }));
    expect(readPendingCompletedReading(ID_A)).toBeNull();
    expect(PUBLIC_METHOD_VERSIONS.manual).toBe("manual-cast-v1");
  });

  it("propagates a blocked write so the handoff can enter sealed recovery", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => { throw new Error("quota exceeded"); },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    });
    expect(() => writePendingCompletedReading(manualReading(ID_A))).toThrow(PENDING_COMPLETED_READING_WRITE_FAILED);
  });

  it("fails closed when localStorage itself is unavailable", () => {
    vi.stubGlobal("window", {});
    expect(readPendingCompletedReading(ID_A)).toBeNull();
    expect(() => writePendingCompletedReading(manualReading(ID_A))).toThrow(PENDING_COMPLETED_READING_WRITE_FAILED);
  });
});
