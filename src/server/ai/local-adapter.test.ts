import { describe, expect, it } from "vitest";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { LineValue } from "@/domain/casting/types";
import { readingReportV2Schema } from "@/domain/generation/schemas";
import { buildDeterministicVerdict } from "@/domain/interpretation/deterministic/verdict";
import { validateGeneratedReading } from "@/server/generation/reading-validator";
import type { ContentLocale } from "@/i18n/config";
import { generateLocalReading } from "./local-adapter";

// The offline adapter is the shape a developer sees when AI_ADAPTER_MODE=local.
// These assertions are the contract that it is the same shape production
// persists: the stored report parses as commercial-reading-v2, and the written
// half survives the same mechanical checks the model's output has to survive.

function cast(lineValuesBottomUp: LineValue[]) {
  return buildHexagramResult({ lineValuesBottomUp, method: "three_coin" });
}

// 兑 (58) with line 2 moving: the moving line sits in one trigram, so Ti-Yong
// applies and the cast carries a direction.
const DIRECTED = cast([7, 9, 8, 7, 7, 8]);
// Both trigrams move: no classical direction can be derived.
const UNDETERMINED = cast([9, 7, 7, 7, 9, 7]);

const QUESTION: Record<ContentLocale, string> = {
  "zh-Hans": "我该不该接受深圳那家公司的offer，下个月要答复",
  en: "Should I accept the Shenzhen offer before I answer them next Monday?",
};

function reading(locale: ContentLocale, result = DIRECTED) {
  return generateLocalReading({
    result,
    scene: "career",
    goal: "what_do_i_need_to_see_clearly",
    context: QUESTION[locale],
    locale,
  });
}

describe.each(["zh-Hans", "en"] as const)("离线适配器 · %s", (locale) => {
  it("produces a report that parses as commercial-reading-v2", () => {
    const parsed = readingReportV2Schema.parse(reading(locale));

    expect(parsed.schemaVersion).toBe("commercial-reading-v2");
    expect(parsed.locale).toBe(locale);
    expect(parsed.readingVariant).toBe("standard");
  });

  it("passes the deterministic validator the model's output has to pass", () => {
    const report = reading(locale);
    const verdict = buildDeterministicVerdict(DIRECTED);

    expect(validateGeneratedReading(report.generated, verdict, QUESTION[locale], locale))
      .toEqual({ valid: true, failures: [] });
  });

  it("cites the classical text the change rule selected, verbatim", () => {
    const report = reading(locale);
    const verdict = buildDeterministicVerdict(DIRECTED);
    const primary = report.deterministic.quotes.find((quote) => quote.role === "primary");

    expect(primary?.text).toBe(verdict.oracle.primary.text);
    expect(primary?.label).toBe(verdict.oracle.primary.label);
    expect(primary?.sourceWork).toBe(verdict.oracle.primary.source.work);
    expect(primary?.sourceUrl).toBe(verdict.oracle.primary.source.textSourceUrl);
  });

  it("echoes the direction the cast decided rather than choosing one", () => {
    const verdict = buildDeterministicVerdict(DIRECTED);
    expect(verdict.direction).not.toBeNull();

    const report = reading(locale);
    expect(report.deterministic.direction).toBe(verdict.direction);
    expect(report.generated.verdictEcho).toBe(verdict.direction);
  });

  it("reports undetermined, and stays valid, when Ti-Yong does not apply", () => {
    const verdict = buildDeterministicVerdict(UNDETERMINED);
    expect(verdict.direction).toBeNull();

    const report = reading(locale, UNDETERMINED);
    readingReportV2Schema.parse(report);

    expect(report.deterministic.direction).toBeNull();
    expect(report.deterministic.tiYong).toBeNull();
    expect(report.generated.verdictEcho).toBe("undetermined");
    expect(validateGeneratedReading(report.generated, verdict, QUESTION[locale], locale))
      .toEqual({ valid: true, failures: [] });
  });

  it("stays valid for a still hexagram, which has no moving line to describe", () => {
    const still = cast([7, 7, 7, 8, 8, 8]);
    const verdict = buildDeterministicVerdict(still);
    const report = reading(locale, still);

    readingReportV2Schema.parse(report);
    expect(report.readingVariant).toBe("still_hexagram");
    expect(report.deterministic.relatingHexagramNumber).toBeNull();
    // Ti-Yong is absent because nothing moves, not because the moving lines
    // span both trigrams. The reading must not give the wrong reason.
    expect(report.generated.structuralReading).not.toMatch(/both trigrams|分处上下两卦/);
    expect(validateGeneratedReading(report.generated, verdict, QUESTION[locale], locale))
      .toEqual({ valid: true, failures: [] });
  });

  it("stays valid when all six lines move", () => {
    const all = cast([9, 9, 9, 9, 9, 9]);
    const verdict = buildDeterministicVerdict(all);
    const report = reading(locale, all);

    readingReportV2Schema.parse(report);
    expect(report.readingVariant).toBe("all_lines_moving");
    expect(validateGeneratedReading(report.generated, verdict, QUESTION[locale], locale))
      .toEqual({ valid: true, failures: [] });
  });

  // The offline path is the one a developer reads all day; a licence
  // placeholder there would keep alive an assumption the design has dropped.
  it("carries no pending_license placeholder anywhere in the report", () => {
    expect(JSON.stringify(reading(locale))).not.toContain("pending_license");
  });
});

describe("离线适配器 · 问题回指", () => {
  // The specificity check is the one rule an offline writer cannot satisfy by
  // template alone, so it names the reader's own words back to them.
  it("names terms taken from the reader's question", () => {
    const report = reading("zh-Hans");

    expect(report.generated.questionRestatement).toContain("深圳");
  });

  // A question can carry phrasing the validator bans outright. Quoting it back
  // verbatim would fail the reading on the reader's own words.
  it("drops question fragments that carry banned phrasing", () => {
    const loaded = "我一定会拿到这个offer吗，下个月答复";
    const verdict = buildDeterministicVerdict(DIRECTED);
    const report = generateLocalReading({
      result: DIRECTED,
      scene: "career",
      goal: "what_do_i_need_to_see_clearly",
      context: loaded,
      locale: "zh-Hans",
    });

    expect(report.generated.questionRestatement).not.toContain("一定会");
    expect(validateGeneratedReading(report.generated, verdict, loaded, "zh-Hans"))
      .toEqual({ valid: true, failures: [] });
  });
});
