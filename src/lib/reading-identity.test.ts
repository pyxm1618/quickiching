import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import {
  PENDING_COMPLETED_READING_TTL_MS,
  readPendingCompletedReading,
  writePendingCompletedReading,
} from "./pending-completed-reading";
import {
  normalizeReadingSessionId,
  publicReadingFromServerCast,
  resolveReadingIdentity,
} from "./reading-identity";

const ID_A = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";
const ID_B = "5e1b2c3d-4a5f-4a6b-8c7d-9e0f1a2b3c4d";

function reading(id: string, lines: [number, number, number, number, number, number] = [7, 8, 9, 6, 7, 8]): PublicReading {
  return buildPublicReading({
    id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 9, 30)).toISOString(),
    method: "manual",
    lineValuesBottomUp: lines,
    evidence: { kind: "manual", mode: "line-values" },
  });
}

function stubLocalStorage() {
  const memory = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      clear: () => memory.clear(),
      key: (index: number) => [...memory.keys()][index] ?? null,
      get length() { return memory.size; },
    },
  });
  return memory;
}

const resolve = (sessionId?: string | null, serverReading?: PublicReading | null, at?: number) =>
  resolveReadingIdentity({
    sessionId,
    serverReading,
    readPending: (readingId) => readPendingCompletedReading(readingId, at),
  });

afterEach(() => vi.unstubAllGlobals());

describe("C3 — exact reading identity", () => {
  it("normalizes session ids without inventing one", () => {
    expect(normalizeReadingSessionId("  abc  ")).toBe("abc");
    expect(normalizeReadingSessionId("   ")).toBeUndefined();
    expect(normalizeReadingSessionId(undefined)).toBeUndefined();
  });

  it("fails closed when the session is missing, even with a pending reading present", () => {
    stubLocalStorage();
    writePendingCompletedReading(reading(ID_A));
    expect(resolve(undefined)).toEqual({ kind: "empty", reason: "missing-session" });
    expect(resolve("")).toEqual({ kind: "empty", reason: "missing-session" });
    expect(resolve("   ")).toEqual({ kind: "empty", reason: "missing-session" });
  });

  it("resolves A and B independently", () => {
    stubLocalStorage();
    writePendingCompletedReading(reading(ID_A, [7, 7, 7, 7, 7, 7]));
    writePendingCompletedReading(reading(ID_B, [8, 8, 8, 8, 8, 8]));
    const a = resolve(ID_A);
    const b = resolve(ID_B);
    expect(a).toMatchObject({ kind: "ready", source: "pending" });
    expect(a.kind === "ready" && a.reading.id).toBe(ID_A);
    expect(a.kind === "ready" && a.reading.lineValuesBottomUp).toEqual([7, 7, 7, 7, 7, 7]);
    expect(b.kind === "ready" && b.reading.id).toBe(ID_B);
    expect(b.kind === "ready" && b.reading.lineValuesBottomUp).toEqual([8, 8, 8, 8, 8, 8]);
  });

  it("never displays B when the request asked for A", () => {
    stubLocalStorage();
    writePendingCompletedReading(reading(ID_B));
    expect(resolve(ID_A)).toEqual({ kind: "empty", reason: "not-found" });
  });

  it("prefers exact server A even when pending B exists", () => {
    stubLocalStorage();
    writePendingCompletedReading(reading(ID_B));
    const serverA = reading(ID_A, [9, 9, 9, 9, 9, 9]);
    const resolved = resolve(ID_A, serverA);
    expect(resolved).toMatchObject({ kind: "ready", source: "server" });
    expect(resolved.kind === "ready" && resolved.reading.lineValuesBottomUp).toEqual([9, 9, 9, 9, 9, 9]);
  });

  it("ignores a server reading that is not the requested identity", () => {
    stubLocalStorage();
    expect(resolve(ID_A, reading(ID_B))).toEqual({ kind: "empty", reason: "not-found" });
  });

  it("treats an expired A as empty even when B is still valid", () => {
    stubLocalStorage();
    const now = Date.UTC(2026, 10, 14, 9, 30);
    writePendingCompletedReading(reading(ID_A), now - PENDING_COMPLETED_READING_TTL_MS - 1);
    writePendingCompletedReading(reading(ID_B), now);
    expect(resolve(ID_A, null, now)).toEqual({ kind: "empty", reason: "not-found" });
    expect(resolve(ID_B, null, now)).toMatchObject({ kind: "ready" });
    // Both are expired once the shared reference time passes the TTL.
    expect(resolve(ID_B, null, now + PENDING_COMPLETED_READING_TTL_MS)).toEqual({ kind: "empty", reason: "not-found" });
  });

  it("builds an exact server reading from persisted cast facts", () => {
    const server = publicReadingFromServerCast({
      castingId: ID_A,
      createdAt: "2026-11-14T09:30:00.000Z",
      method: "manual",
      question: "Should I move?",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      methodCalculation: { mode: "line-values" },
      internalMethod: "manual",
    });
    expect(server.id).toBe(ID_A);
    expect(server.method).toBe("manual");
    expect(server.question).toBe("Should I move?");
    expect(resolve(ID_A, server)).toMatchObject({ kind: "ready", source: "server" });
  });

  it("refuses to invent server evidence that the cast does not support", () => {
    expect(() => publicReadingFromServerCast({
      castingId: ID_A,
      createdAt: "2026-11-14T09:30:00.000Z",
      method: "yarrow-stalks",
      lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
      methodCalculation: { changes: [] },
      internalMethod: "yarrow_stalk",
    })).toThrow("YARROW_READING_EVIDENCE_UNAVAILABLE");
  });
});
