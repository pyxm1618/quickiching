
import { describe, expect, it } from "vitest";
import { PRIMARY_RELATING_SINGLE_CHANGE_VALUES, linePolarity, relatingPolarity } from "./info-diagrams";

describe("Info page I Ching diagrams", () => {
  it("keeps 7 and 8 stable and changes only 6 and 9", () => {
    expect(linePolarity(7)).toBe("yang");
    expect(relatingPolarity(7)).toBe("yang");
    expect(linePolarity(8)).toBe("yin");
    expect(relatingPolarity(8)).toBe("yin");
    expect(linePolarity(6)).toBe("yin");
    expect(relatingPolarity(6)).toBe("yang");
    expect(linePolarity(9)).toBe("yang");
    expect(relatingPolarity(9)).toBe("yin");
  });
  it("changes exactly one position in the primary/relating visual example", () => {
    const changed = PRIMARY_RELATING_SINGLE_CHANGE_VALUES.filter((value) => linePolarity(value) !== relatingPolarity(value));
    expect(changed).toEqual([6]);
  });
});
