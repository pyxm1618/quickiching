// 变占规则 — Zhu Xi, 《易学启蒙·考变占》. Given how many lines moved, these seven
// rules fix which classical text is the primary oracle for the cast. Encoding
// them here is what keeps the choice of text a matter of rule rather than a
// matter of model preference.

export type OracleTextRef =
  | { kind: "judgment"; hexagram: "primary" | "relating" }
  | { kind: "line"; hexagram: "primary" | "relating"; position: number }
  | { kind: "use_line"; hexagram: "primary"; label: "用九" | "用六" };

export type ChangeRuleId =
  | "no_moving"
  | "one_moving"
  | "two_moving"
  | "three_moving"
  | "four_moving"
  | "five_moving"
  | "six_moving_qian"
  | "six_moving_kun"
  | "six_moving_other";

export type ChangeRuleResult = {
  movingCount: number;
  // The single text the reading hinges on.
  primary: OracleTextRef;
  // Supporting texts, in the order the rule ranks them.
  supporting: OracleTextRef[];
  // Identifies the classical rule applied. Rendering it as prose is the
  // localization layer's job; the engine stays language-neutral.
  ruleId: ChangeRuleId;
};

const QIAN = 1;
const KUN = 2;

function ascending(positions: readonly number[]): number[] {
  return [...positions].sort((left, right) => left - right);
}

function quietPositions(movingLinePositions: readonly number[]): number[] {
  const moving = new Set(movingLinePositions);
  return [1, 2, 3, 4, 5, 6].filter((position) => !moving.has(position));
}

/**
 * Select the governing classical text for a cast.
 *
 * @param primaryHexagramNumber King Wen number of the cast hexagram.
 * @param movingLinePositions 1-indexed positions, bottom-up; order is ignored.
 */
export function selectOracleText(input: {
  primaryHexagramNumber: number;
  movingLinePositions: readonly number[];
}): ChangeRuleResult {
  const moving = ascending(input.movingLinePositions);
  const movingCount = moving.length;

  if (movingCount === 0) {
    return {
      movingCount,
      primary: { kind: "judgment", hexagram: "primary" },
      supporting: [],
      ruleId: "no_moving",
    };
  }

  if (movingCount === 1) {
    return {
      movingCount,
      primary: { kind: "line", hexagram: "primary", position: moving[0] },
      supporting: [{ kind: "judgment", hexagram: "primary" }],
      ruleId: "one_moving",
    };
  }

  if (movingCount === 2) {
    // Upper moving line governs.
    const [lower, upper] = [moving[0], moving[1]];
    return {
      movingCount,
      primary: { kind: "line", hexagram: "primary", position: upper },
      supporting: [{ kind: "line", hexagram: "primary", position: lower }],
      ruleId: "two_moving",
    };
  }

  if (movingCount === 3) {
    return {
      movingCount,
      primary: { kind: "judgment", hexagram: "primary" },
      supporting: [{ kind: "judgment", hexagram: "relating" }],
      ruleId: "three_moving",
    };
  }

  if (movingCount === 4) {
    // Two lines stay quiet; the lower of them governs, read in the relating hexagram.
    const quiet = quietPositions(moving);
    return {
      movingCount,
      primary: { kind: "line", hexagram: "relating", position: quiet[0] },
      supporting: [{ kind: "line", hexagram: "relating", position: quiet[1] }],
      ruleId: "four_moving",
    };
  }

  if (movingCount === 5) {
    const quiet = quietPositions(moving);
    return {
      movingCount,
      primary: { kind: "line", hexagram: "relating", position: quiet[0] },
      supporting: [],
      ruleId: "five_moving",
    };
  }

  // Six moving lines. Qian and Kun have their own use-line texts; every other
  // hexagram is read from the relating hexagram's judgment.
  if (input.primaryHexagramNumber === QIAN) {
    return {
      movingCount,
      primary: { kind: "use_line", hexagram: "primary", label: "用九" },
      supporting: [{ kind: "judgment", hexagram: "relating" }],
      ruleId: "six_moving_qian",
    };
  }
  if (input.primaryHexagramNumber === KUN) {
    return {
      movingCount,
      primary: { kind: "use_line", hexagram: "primary", label: "用六" },
      supporting: [{ kind: "judgment", hexagram: "relating" }],
      ruleId: "six_moving_kun",
    };
  }
  return {
    movingCount,
    primary: { kind: "judgment", hexagram: "relating" },
    supporting: [{ kind: "judgment", hexagram: "primary" }],
    ruleId: "six_moving_other",
  };
}
