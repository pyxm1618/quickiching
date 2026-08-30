import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { buildDeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import { questionKeyTerms, validateGeneratedReading } from "./reading-validator";

const QUESTION = "我该不该接受深圳那家公司的offer，下个月要答复";

// 兑 (58) with line 2 moving: Ti-Yong applies, so a direction exists.
const VERDICT = buildDeterministicVerdict(
  buildHexagramResult({ lineValuesBottomUp: [7, 9, 8, 7, 7, 8] as LineValue[], method: "three_coin" }),
);
// Both trigrams move: no classical direction can be derived.
const UNDETERMINED_VERDICT = buildDeterministicVerdict(
  buildHexagramResult({ lineValuesBottomUp: [9, 7, 7, 7, 9, 7] as LineValue[], method: "three_coin" }),
);

function validReading(overrides: Record<string, unknown> = {}) {
  return {
    verdictEcho: VERDICT.direction ?? "undetermined",
    questionRestatement: "你在问深圳那家公司的offer要不要接。",
    oracleApplication: `${VERDICT.oracle.primary.label}讲的是以诚相待而后有得，落到这个offer上，指的是对方给出的条件基本可信。`,
    currentStage: "你处在答复期限之前的权衡阶段。",
    structuralReading: "体用同为兑金，说明你与这家公司的节奏接近。",
    changeMechanism: "由兑之随，重心从取悦转向跟随既定安排。",
    obstacles: "主要阻碍是你尚未确认深圳的长期落脚成本。",
    turningConditions: "若对方在答复期限前给出书面条款，判断依据就完整了。",
    conditionalGuidance: "若书面条款与口头一致，则可以接受；否则宜再谈。",
    uncertaintyAndBoundaries: "这是反思参考，不替代你对合同条款的独立判断。",
    ...overrides,
  };
}

describe("深度解读确定性校验 (deterministic reading validation)", () => {
  it("accepts a reading that echoes the verdict and stays specific", () => {
    const result = validateGeneratedReading(validReading(), VERDICT, QUESTION, "zh-Hans");

    expect(result).toEqual({ valid: true, failures: [] });
  });

  it("rejects output that does not match the generated schema", () => {
    const result = validateGeneratedReading({ verdictEcho: "favorable" }, VERDICT, QUESTION, "zh-Hans");

    expect(result.failures).toEqual(["SCHEMA_INVALID"]);
  });

  // The core guarantee: the model cannot re-decide the verdict.
  it("rejects a reading that reports a different direction than the cast determined", () => {
    const flipped = VERDICT.direction === "obstructed" ? "favorable" : "obstructed";
    const result = validateGeneratedReading(validReading({ verdictEcho: flipped }), VERDICT, QUESTION, "zh-Hans");

    expect(result.valid).toBe(false);
    expect(result.failures).toContain("VERDICT_ECHO_MISMATCH");
  });

  it("requires undetermined when the cast yields no direction", () => {
    expect(UNDETERMINED_VERDICT.direction).toBeNull();

    const claimed = validateGeneratedReading(validReading({ verdictEcho: "favorable" }), UNDETERMINED_VERDICT, QUESTION, "zh-Hans");
    expect(claimed.failures).toContain("VERDICT_ECHO_MISMATCH");

    const honest = validateGeneratedReading(validReading({ verdictEcho: "undetermined" }), UNDETERMINED_VERDICT, QUESTION, "zh-Hans");
    expect(honest.valid).toBe(true);
  });

  // The model may quote only what it was given.
  it("rejects a quotation that was not among the supplied classical texts", () => {
    const result = validateGeneratedReading(validReading({ oracleApplication: "正如「潜龙勿用，君子终日乾乾」所说，你应当按兵不动。" }), VERDICT, QUESTION, "zh-Hans");

    expect(result.valid).toBe(false);
    expect(result.failures).toContain("QUOTE_FABRICATED");
  });

  it("accepts a verbatim quotation of the supplied text", () => {
    const result = validateGeneratedReading(validReading({ oracleApplication: `原文「${VERDICT.oracle.primary.text}」在这件事上指向对方条件可信。` }), VERDICT, QUESTION, "zh-Hans");

    expect(result.valid).toBe(true);
  });

  it("rejects absolute predictions", () => {
    const result = validateGeneratedReading(validReading({ currentStage: "这个offer你接下来必然会后悔。" }), VERDICT, QUESTION, "zh-Hans");

    expect(result.failures).toContain("ABSOLUTE_PREDICTION");
  });

  it("rejects professional directives outside the product boundary", () => {
    const result = validateGeneratedReading(validReading({ obstacles: "建议你全仓买入该公司股票以示信心。" }), VERDICT, QUESTION, "zh-Hans");

    expect(result.failures).toContain("PROHIBITED_DIRECTIVE");
  });

  it("requires the guidance module to be phrased conditionally", () => {
    const result = validateGeneratedReading(validReading({ conditionalGuidance: "接受这个offer。" }), VERDICT, QUESTION, "zh-Hans");

    expect(result.failures).toContain("GUIDANCE_NOT_CONDITIONAL");
  });

  it("rejects a reading that never engages with the user's own words", () => {
    const generic = validReading({
      questionRestatement: "你在权衡一个选择。",
      oracleApplication: "此爻讲以诚相待而后有得。",
      currentStage: "你处在权衡阶段。",
      structuralReading: "体用同类，节奏接近。",
      changeMechanism: "重心由取悦转向跟随。",
      obstacles: "尚有信息未确认。",
      turningConditions: "若信息补齐，判断依据完整。",
      conditionalGuidance: "若条件一致，则可推进；否则再谈。",
      uncertaintyAndBoundaries: "这是反思参考。",
    });

    const result = validateGeneratedReading(generic, VERDICT, QUESTION, "zh-Hans");

    expect(result.failures).toContain("NOT_SPECIFIC_TO_QUESTION");
  });

  it("extracts CJK runs and Latin words as question terms", () => {
    const terms = questionKeyTerms(QUESTION);

    expect(terms).toContain("深圳");
    expect(terms).toContain("offer");
  });

  it("skips the specificity check when a question yields no usable terms", () => {
    const result = validateGeneratedReading(validReading(), VERDICT, "?? ...", "zh-Hans");

    expect(result.failures).not.toContain("NOT_SPECIFIC_TO_QUESTION");
  });
});

describe("深度解读校验 · 多语言", () => {
  const EN_QUESTION = "Should I accept the Shenzhen offer before next Monday?";

  function englishReading(overrides: Record<string, unknown> = {}) {
    return {
      verdictEcho: VERDICT.direction ?? "undetermined",
      questionRestatement: "You are asking whether to accept the Shenzhen offer.",
      oracleApplication: "The moving line speaks of sincerity rewarded; for this Shenzhen offer it points to terms that are broadly credible.",
      currentStage: "You are in the window before next Monday's answer on the Shenzhen role.",
      structuralReading: "Both trigrams share one phase, so you and this employer move at a similar pace.",
      changeMechanism: "The shift is from pleasing others toward following an arrangement already set.",
      obstacles: "The main blind spot is the unconfirmed cost of relocating to Shenzhen.",
      turningConditions: "Written terms before Monday would complete the basis for a decision.",
      conditionalGuidance: "If the written terms match what was said aloud, this step is workable; otherwise reopen the discussion.",
      uncertaintyAndBoundaries: "This is a reflective reading, not a substitute for your own review of the contract.",
      ...overrides,
    };
  }

  it("accepts a compliant English reading", () => {
    expect(validateGeneratedReading(englishReading(), VERDICT, EN_QUESTION, "en"))
      .toEqual({ valid: true, failures: [] });
  });

  it("applies the conditional-phrasing check in the reading's own language", () => {
    const result = validateGeneratedReading(
      englishReading({ conditionalGuidance: "Accept the Shenzhen offer." }),
      VERDICT,
      EN_QUESTION,
      "en",
    );

    expect(result.failures).toContain("GUIDANCE_NOT_CONDITIONAL");
  });

  // A reading must not escape a safety rule by being written in another
  // language, so the banned patterns of every locale always apply.
  it("rejects an absolute prediction regardless of the output language", () => {
    const english = validateGeneratedReading(
      englishReading({ currentStage: "You are destined to regret the Shenzhen move." }),
      VERDICT,
      EN_QUESTION,
      "en",
    );
    expect(english.failures).toContain("ABSOLUTE_PREDICTION");

    const mixed = validateGeneratedReading(
      englishReading({ currentStage: "This Shenzhen move 必然会 fail." }),
      VERDICT,
      EN_QUESTION,
      "en",
    );
    expect(mixed.failures).toContain("ABSOLUTE_PREDICTION");
  });

  it("still forbids fabricated quotations in an English reading", () => {
    const result = validateGeneratedReading(
      englishReading({ oracleApplication: "As the classic says 「潜龙勿用，君子终日乾乾」, hold back." }),
      VERDICT,
      EN_QUESTION,
      "en",
    );

    expect(result.failures).toContain("QUOTE_FABRICATED");
  });
});
