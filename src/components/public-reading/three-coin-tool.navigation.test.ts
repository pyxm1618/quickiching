import { describe, expect, it } from "vitest";
import { shouldNavigateCompletedThreeCoin } from "./three-coin-tool";

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
