import { describe, expect, it } from "vitest";
import { canRecordSettledThreeCoin, shouldNavigateCompletedThreeCoin } from "./three-coin-tool";

const completeState = {
  restored: true,
  complete: true,
  visuallyComplete: true,
  hasReadingMeta: true,
  storageBlocked: false,
  hasUnpersistedCommit: false,
  completionNavigationArmed: true,
  resultNavigationStarted: false,
};

describe("ThreeCoinTool completion navigation", () => {
  it("does not redirect merely because a completed session was restored on mount", () => {
    expect(shouldNavigateCompletedThreeCoin({
      ...completeState,
      completionNavigationArmed: false,
    })).toBe(false);
  });

  it("navigates only after the newly persisted sixth line has visually settled", () => {
    expect(shouldNavigateCompletedThreeCoin({
      ...completeState,
      visuallyComplete: false,
    })).toBe(false);
    expect(shouldNavigateCompletedThreeCoin(completeState)).toBe(true);
  });

  it("allows a new reading state to remain on the casting page", () => {
    expect(shouldNavigateCompletedThreeCoin({
      ...completeState,
      complete: false,
      visuallyComplete: false,
      hasReadingMeta: false,
      completionNavigationArmed: false,
    })).toBe(false);
  });
});


describe("ThreeCoinTool visual record boundary", () => {
  it("allows Record This Cast only for a persisted settled line that is not yet in visual progress", () => {
    expect(canRecordSettledThreeCoin({
      homeRitual: true,
      motion: "settled",
      storageBlocked: false,
      stepCount: 1,
      revealedCount: 0,
    })).toBe(true);
  });

  it("does not record while casting, after storage failure, or after the line is already recorded", () => {
    expect(canRecordSettledThreeCoin({ homeRitual: true, motion: "casting", storageBlocked: false, stepCount: 1, revealedCount: 0 })).toBe(false);
    expect(canRecordSettledThreeCoin({ homeRitual: true, motion: "settled", storageBlocked: true, stepCount: 1, revealedCount: 0 })).toBe(false);
    expect(canRecordSettledThreeCoin({ homeRitual: true, motion: "settled", storageBlocked: false, stepCount: 1, revealedCount: 1 })).toBe(false);
    expect(canRecordSettledThreeCoin({ homeRitual: false, motion: "settled", storageBlocked: false, stepCount: 1, revealedCount: 0 })).toBe(false);
  });

  it("does not navigate after the sixth business step until the sixth line is visually recorded", () => {
    expect(shouldNavigateCompletedThreeCoin({
      ...completeState,
      visuallyComplete: false,
    })).toBe(false);
    expect(shouldNavigateCompletedThreeCoin({
      ...completeState,
      visuallyComplete: true,
    })).toBe(true);
  });
});
