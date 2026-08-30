import { describe, expect, it } from "vitest";
import {
  CHANGE_RULE_TEXT,
  DIRECTION_TEXT,
  RELATION_TEXT,
  TRIGRAM_IMAGE,
} from "@/domain/interpretation/deterministic/localize";
import {
  changeRuleFact,
  directionFact,
  linePositionFacts,
  tiYongFact,
} from "./deterministic-facts";

describe("change rule wording", () => {
  it("comes from the localisation table for every known rule", () => {
    for (const ruleId of Object.keys(CHANGE_RULE_TEXT.en)) {
      expect(changeRuleFact(ruleId, "en").text).toBe(CHANGE_RULE_TEXT.en[ruleId as never]);
      expect(changeRuleFact(ruleId, "zh-Hans").text).toBe(CHANGE_RULE_TEXT["zh-Hans"][ruleId as never]);
    }
  });

  it("differs between locales rather than being one hardcoded language", () => {
    expect(changeRuleFact("one_moving", "en").text).not.toBe(changeRuleFact("one_moving", "zh-Hans").text);
  });

  it("reports an unknown rule as unwordable instead of inventing text", () => {
    expect(changeRuleFact("rule_from_a_newer_engine", "en")).toEqual({
      id: "rule_from_a_newer_engine",
      text: null,
    });
  });

  it("keeps the identifier alongside the wording", () => {
    expect(changeRuleFact("no_moving", "en").id).toBe("no_moving");
  });
});

describe("verdict direction wording", () => {
  it("comes from the localisation table for every known direction", () => {
    for (const direction of Object.keys(DIRECTION_TEXT.en)) {
      expect(directionFact(direction, "en")?.text).toBe(DIRECTION_TEXT.en[direction as never]);
      expect(directionFact(direction, "zh-Hans")?.text).toBe(DIRECTION_TEXT["zh-Hans"][direction as never]);
    }
  });

  it("is absent when the engine could not determine one", () => {
    expect(directionFact(null, "en")).toBeNull();
  });

  it("reports an unknown direction as unwordable", () => {
    expect(directionFact("sideways", "en")).toEqual({ id: "sideways", text: null });
  });
});

describe("ti and yong wording", () => {
  const tiYong = { tiTrigram: "gen", yongTrigram: "kan", relation: "yong_generates_ti" };

  it("localises both trigrams and the relation", () => {
    const fact = tiYongFact(tiYong, "en");

    expect(fact?.ti.text).toBe(TRIGRAM_IMAGE.en.gen);
    expect(fact?.yong.text).toBe(TRIGRAM_IMAGE.en.kan);
    expect(fact?.relation.text).toBe(RELATION_TEXT.en.yong_generates_ti);
  });

  it("switches every part with the locale", () => {
    const english = tiYongFact(tiYong, "en");
    const chinese = tiYongFact(tiYong, "zh-Hans");

    expect(chinese?.ti.text).toBe(TRIGRAM_IMAGE["zh-Hans"].gen);
    expect(chinese?.relation.text).toBe(RELATION_TEXT["zh-Hans"].yong_generates_ti);
    expect(chinese?.ti.text).not.toBe(english?.ti.text);
    expect(chinese?.relation.text).not.toBe(english?.relation.text);
  });

  it("carries the trigram quality as well as its image", () => {
    expect(tiYongFact(tiYong, "en")?.ti.quality).toBeTruthy();
  });

  it("is absent when Ti-Yong does not apply", () => {
    expect(tiYongFact(null, "en")).toBeNull();
  });

  it("reports unknown trigrams and relations as unwordable", () => {
    const fact = tiYongFact({ tiTrigram: "xxx", yongTrigram: "yyy", relation: "zzz" }, "en");

    expect(fact?.ti).toEqual({ id: "xxx", text: null, quality: null });
    expect(fact?.yong).toEqual({ id: "yyy", text: null, quality: null });
    expect(fact?.relation).toEqual({ id: "zzz", text: null });
  });
});

describe("line position wording", () => {
  it("localises each moving line", () => {
    const facts = linePositionFacts([1, 5], "en");

    expect(facts.map((fact) => fact.position)).toEqual([1, 5]);
    expect(facts.every((fact) => typeof fact.text === "string" && fact.text.length > 0)).toBe(true);
  });

  it("switches with the locale", () => {
    expect(linePositionFacts([3], "en")[0]!.text).not.toBe(linePositionFacts([3], "zh-Hans")[0]!.text);
  });

  it("reports an out-of-range position as unwordable rather than throwing", () => {
    expect(linePositionFacts([9], "en")).toEqual([{ position: 9, text: null }]);
  });

  it("is empty when nothing moves", () => {
    expect(linePositionFacts([], "en")).toEqual([]);
  });
});
