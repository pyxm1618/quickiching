import { describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { completeReadingHandoff, performReadingHandoff, readingHandoffFailureCopy } from "./reading-handoff";

const ID_A = "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f";
const ID_B = "5e1b2c3d-4a5f-4a6b-8c7d-9e0f1a2b3c4d";

function reading(id = ID_A): PublicReading {
  return buildPublicReading({
    id,
    createdAt: new Date(Date.UTC(2026, 10, 14, 9, 30)).toISOString(),
    method: "manual",
    lineValuesBottomUp: [7, 8, 9, 6, 7, 8],
    evidence: { kind: "manual", mode: "line-values" },
  });
}

function harness(overrides: Partial<{
  writePending: () => void;
  readPending: () => PublicReading | null;
  retireSession: () => void;
  isSessionRetired: () => boolean;
}> = {}) {
  const calls: string[] = [];
  const dependencies = {
    writePending: () => { calls.push("write-pending"); overrides.writePending?.(); },
    readPending: () => { calls.push("read-pending"); return overrides.readPending ? overrides.readPending() : reading(); },
    retireSession: () => { calls.push("retire-session"); overrides.retireSession?.(); },
    isSessionRetired: () => { calls.push("verify-retirement"); return overrides.isSessionRetired?.() ?? true; },
    navigate: (href: string) => { calls.push(`replace:${href}`); },
  };
  return { calls, dependencies };
}

describe("C2 / C7 — Reading handoff transaction", () => {
  it("commits pending, verifies it, retires the session, verifies retirement, then replaces", () => {
    const { calls, dependencies } = harness();
    const outcome = performReadingHandoff(reading(), { dependencies });
    expect(outcome).toEqual({
      kind: "navigated",
      readingId: ID_A,
      href: `/readings/choice?session=${ID_A}`,
    });
    expect(calls).toEqual([
      "write-pending",
      "read-pending",
      "retire-session",
      "verify-retirement",
      `replace:/readings/choice?session=${ID_A}`,
    ]);
  });

  it("never navigates when the pending write fails and keeps the exact reading id", () => {
    const { calls, dependencies } = harness({ writePending: () => { throw new Error("blocked"); } });
    const outcome = performReadingHandoff(reading(), { dependencies });
    expect(outcome).toMatchObject({ kind: "failed", stage: "pending", readingId: ID_A });
    expect(calls).toEqual(["write-pending"]);
    expect(calls.some((call) => call.startsWith("replace:"))).toBe(false);
  });

  it("never navigates when the pending write cannot be read back exactly", () => {
    const nullRead = harness({ readPending: () => null });
    expect(performReadingHandoff(reading(), { dependencies: nullRead.dependencies }))
      .toMatchObject({ kind: "failed", stage: "pending", code: "PENDING_VERIFY_FAILED" });
    expect(nullRead.calls).toEqual(["write-pending", "read-pending"]);

    const wrongReading = harness({ readPending: () => reading(ID_B) });
    expect(performReadingHandoff(reading(), { dependencies: wrongReading.dependencies }))
      .toMatchObject({ kind: "failed", stage: "pending", code: "PENDING_VERIFY_FAILED" });
    expect(wrongReading.calls.some((call) => call.startsWith("replace:"))).toBe(false);
  });

  it("never navigates when session retirement throws", () => {
    const { calls, dependencies } = harness({ retireSession: () => { throw new Error("clear failed"); } });
    const outcome = performReadingHandoff(reading(), { dependencies });
    expect(outcome).toMatchObject({ kind: "failed", stage: "retire", readingId: ID_A });
    expect(calls).toEqual(["write-pending", "read-pending", "retire-session"]);
  });

  it("never navigates when session retirement cannot be verified", () => {
    const { calls, dependencies } = harness({ isSessionRetired: () => false });
    const outcome = performReadingHandoff(reading(), { dependencies });
    expect(outcome).toMatchObject({ kind: "failed", stage: "retire", code: "SESSION_RETIRE_UNVERIFIED" });
    expect(calls).toEqual(["write-pending", "read-pending", "retire-session", "verify-retirement"]);
  });

  it("retries with the same readingId and never mints a new one", () => {
    const failed = harness({ retireSession: () => { throw new Error("clear failed"); } });
    const first = performReadingHandoff(reading(), { dependencies: failed.dependencies });
    const retried = performReadingHandoff(reading(), { dependencies: harness().dependencies });
    expect(first).toMatchObject({ kind: "failed", readingId: ID_A });
    expect(retried).toMatchObject({ kind: "navigated", readingId: ID_A });
    expect(retried.kind === "navigated" && retried.href).toBe(`/readings/choice?session=${ID_A}`);
  });

  it("localizes the Choice route without changing identity", () => {
    const { dependencies } = harness();
    const outcome = performReadingHandoff(reading(), { zh: true, dependencies });
    expect(outcome).toMatchObject({ href: `/zh/readings/choice?session=${ID_A}` });
  });

  it("uses replace only, exactly once, through the router adapter", () => {
    const replace = vi.fn();
    const push = vi.fn();
    const outcome = completeReadingHandoff({
      reading: reading(),
      router: { replace, push } as unknown as { replace: (href: string) => void },
      dependencies: {
        writePending: () => {},
        readPending: () => reading(),
        retireSession: () => {},
        isSessionRetired: () => true,
      },
    });
    expect(outcome.kind).toBe("navigated");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`/readings/choice?session=${ID_A}`);
    expect(push).not.toHaveBeenCalled();
  });

  it("describes both failure stages without ever suggesting a recast", () => {
    const pendingCopy = readingHandoffFailureCopy({ kind: "failed", readingId: ID_A, stage: "pending", code: "X" }, false);
    const retireCopy = readingHandoffFailureCopy({ kind: "failed", readingId: ID_A, stage: "retire", code: "X" }, false);
    expect(pendingCopy).toContain("same cast is preserved");
    expect(retireCopy).toContain("same cast is preserved");
    expect(readingHandoffFailureCopy({ kind: "navigated", readingId: ID_A, href: "/x" }, false)).toBeNull();
    expect(readingHandoffFailureCopy({ kind: "failed", readingId: ID_A, stage: "pending", code: "X" }, true)).toContain("相同的卦象");
  });
});
