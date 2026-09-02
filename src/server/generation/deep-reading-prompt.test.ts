import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { buildDeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import { describeChangeRule } from "@/domain/interpretation/deterministic/localize";
import { buildDeepReadingPrompt } from "./deep-reading-prompt";

function verdictFor(lineValues: LineValue[]) {
  return buildDeterministicVerdict(
    buildHexagramResult({ lineValuesBottomUp: lineValues, method: "three_coin" }),
  );
}

const DIRECTED = verdictFor([7, 9, 8, 7, 7, 8]);
const UNDETERMINED = verdictFor([9, 7, 7, 7, 9, 7]);

const BASE = {
  question: "我该不该接受深圳那家公司的offer",
  scene: "career",
  interpretationGoal: "what_is_blocking_this_situation",
  locale: "zh-Hans",
} as const;

describe("深度解读 prompt", () => {
  it("carries the selected classical text verbatim into the prompt", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.user).toContain(DIRECTED.oracle.primary.text);
    expect(prompt.user).toContain(DIRECTED.oracle.primary.label);
    expect(prompt.user).toContain(describeChangeRule(DIRECTED.changeRule.ruleId, "zh-Hans"));
  });

  it("states the decided direction rather than asking for one", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(DIRECTED.direction).not.toBeNull();
    expect(prompt.user).toContain(DIRECTED.direction!);
    expect(prompt.system).toContain("direction is already decided");
  });

  // The honest branch: when Ti-Yong does not apply the prompt must not invite
  // the model to supply a direction of its own.
  it("tells the model to withhold a direction when the cast determines none", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: UNDETERMINED });

    expect(UNDETERMINED.direction).toBeNull();
    expect(prompt.user).toContain("undetermined");
    expect(prompt.system).toContain("never supply a direction of your own");
  });

  it("forbids quoting anything that was not supplied", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.system).toContain("the only text you may quote");
    expect(prompt.system).toContain("Supplying remembered classical text is a severe error");
  });

  // The validator treats any bracketed run as a claimed quotation, so the
  // prompt has to reserve brackets for classical text. Without this, ordinary
  // Chinese emphasis marks would fail a compliant reading.
  it("reserves quotation brackets for classical text only", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.system).toContain("reserved for the supplied classical text");
    expect(prompt.system).toContain("Write emphasis plainly");
  });

  it("marks the user question as untrusted data", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.user).toContain("untrusted data");
    expect(prompt.user).toContain(BASE.question);
  });

  it("maps the scene onto what 体 and 用 stand for", () => {
    const career = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });
    const relationships = buildDeepReadingPrompt({
      ...BASE,
      scene: "relationships",
      verdict: DIRECTED,
    });

    expect(career.system).toContain("这份工作、职位或机会本身");
    expect(relationships.system).toContain("对方与你们之间的关系");
  });

  it("weights the modules the stated goal cares about", () => {
    const blocking = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });
    const timing = buildDeepReadingPrompt({
      ...BASE,
      interpretationGoal: "is_the_timing_favorable",
      verdict: DIRECTED,
    });

    expect(blocking.system).toContain("obstacles");
    expect(timing.system).toContain("currentStage");
  });

  it("requires conditional phrasing and bans absolute prediction", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.system).toContain("Phrase the direction conditionally");
    expect(prompt.system).toContain("Never make absolute predictions");
  });

  it("includes the structural facts the reading must not contradict", () => {
    const prompt = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });

    expect(prompt.user).toContain(DIRECTED.primaryHexagram.chineseName);
    expect(prompt.user).toContain(DIRECTED.nuclearHexagram.chineseName);
    expect(prompt.user).toContain("Ti-Yong");
  });
});

// Multi-language is a product requirement, not a future one. The instructions
// are written once in English and carry a locale directive, so adding a site
// language must not require translating this prompt.
describe("深度解读 prompt · 多语言", () => {
  it("directs the model to write in the reader's language", () => {
    const zh = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });
    const en = buildDeepReadingPrompt({ ...BASE, locale: "en", verdict: DIRECTED });

    expect(zh.system).toContain("Simplified Chinese");
    expect(en.system).toContain("write every field in English");
    expect(zh.system).toContain("Do not mix languages");
  });

  it("requires an English reading to gloss the Chinese classical text", () => {
    const en = buildDeepReadingPrompt({ ...BASE, locale: "en", verdict: DIRECTED });

    // The quotation stays in its source script, so an English reader must not
    // be left with an untranslated fragment.
    expect(en.user).toContain(DIRECTED.oracle.primary.text);
    expect(en.system).toContain("plain-English gloss");
  });

  it("localizes the change rule and structural description", () => {
    const zh = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });
    const en = buildDeepReadingPrompt({ ...BASE, locale: "en", verdict: DIRECTED });

    expect(zh.user).toContain(describeChangeRule(DIRECTED.changeRule.ruleId, "zh-Hans"));
    expect(en.user).toContain(describeChangeRule(DIRECTED.changeRule.ruleId, "en"));
    expect(en.user).not.toContain(describeChangeRule(DIRECTED.changeRule.ruleId, "zh-Hans"));
  });

  it("keeps the verified facts identical across languages", () => {
    const zh = buildDeepReadingPrompt({ ...BASE, verdict: DIRECTED });
    const en = buildDeepReadingPrompt({ ...BASE, locale: "en", verdict: DIRECTED });

    // Language changes the wording, never the cast.
    expect(zh.user).toContain(DIRECTED.oracle.primary.text);
    expect(en.user).toContain(DIRECTED.oracle.primary.text);
    expect(zh.user).toContain(DIRECTED.direction!);
    expect(en.user).toContain(DIRECTED.direction!);
  });
});
