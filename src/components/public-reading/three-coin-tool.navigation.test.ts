import { describe, expect, it } from "vitest";
import { canRecordSettledThreeCoin, shouldHandoffFreshThreeCoinCompletion } from "./three-coin-tool";

const freshCompleteState = {
  freshCompletion: true,
  complete: true,
  visuallyComplete: true,
  hasReadingMeta: true,
  storageBlocked: false,
  hasUnpersistedCommit: false,
  handoffStarted: false,
  sealedRecovery: false,
};

describe("ThreeCoinTool completion handoff", () => {
  it("does not navigate when a completed session is restored on mount", () => {
    // C1: restored completed state is not a fresh completion and must never move
    // the user into Reading Choice by itself.
    expect(shouldHandoffFreshThreeCoinCompletion({
      ...freshCompleteState,
      freshCompletion: false,
    })).toBe(false);
  });

  it("hands off exactly once after the freshly cast sixth line is visually recorded", () => {
    expect(shouldHandoffFreshThreeCoinCompletion(freshCompleteState)).toBe(true);
    expect(shouldHandoffFreshThreeCoinCompletion({
      ...freshCompleteState,
      handoffStarted: true,
    })).toBe(false);
  });

  it("does not hand off before the sixth line has visually settled", () => {
    expect(shouldHandoffFreshThreeCoinCompletion({
      ...freshCompleteState,
      visuallyComplete: false,
    })).toBe(false);
  });

  it("does not hand off with blocked storage, an unpersisted commit, or sealed recovery", () => {
    expect(shouldHandoffFreshThreeCoinCompletion({ ...freshCompleteState, storageBlocked: true })).toBe(false);
    expect(shouldHandoffFreshThreeCoinCompletion({ ...freshCompleteState, hasUnpersistedCommit: true })).toBe(false);
    expect(shouldHandoffFreshThreeCoinCompletion({ ...freshCompleteState, sealedRecovery: true })).toBe(false);
    expect(shouldHandoffFreshThreeCoinCompletion({ ...freshCompleteState, hasReadingMeta: false })).toBe(false);
    expect(shouldHandoffFreshThreeCoinCompletion({ ...freshCompleteState, complete: false })).toBe(false);
  });
});

describe("ThreeCoinTool visual record boundary", () => {
  it("allows Record This Cast only for a persisted settled line that is not yet in visual progress", () => {
    expect(canRecordSettledThreeCoin({
      motion: "settled",
      storageBlocked: false,
      stepCount: 1,
      revealedCount: 0,
    })).toBe(true);
  });

  it("does not record while casting, after storage failure, or after the line is already recorded", () => {
    expect(canRecordSettledThreeCoin({ motion: "casting", storageBlocked: false, stepCount: 1, revealedCount: 0 })).toBe(false);
    expect(canRecordSettledThreeCoin({ motion: "settled", storageBlocked: true, stepCount: 1, revealedCount: 0 })).toBe(false);
    expect(canRecordSettledThreeCoin({ motion: "settled", storageBlocked: false, stepCount: 1, revealedCount: 1 })).toBe(false);
  });
});
