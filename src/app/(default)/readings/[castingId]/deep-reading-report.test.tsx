import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readingReportV2Schema, type CommercialReadingReportV2 } from "@/domain/generation/schemas";
import {
  CHANGE_RULE_TEXT,
  DIRECTION_TEXT,
  RELATION_TEXT,
} from "@/domain/interpretation/deterministic/localize";
import { DeepReadingReport, DeterministicHalf, GeneratedHalf } from "./deep-reading-report";

function report(overrides: Record<string, unknown> = {}): CommercialReadingReportV2 {
  const base = {
    schemaVersion: "commercial-reading-v2",
    locale: "en",
    readingVariant: "standard",
    deterministic: {
      primaryHexagramNumber: 24,
      relatingHexagramNumber: 2,
      nuclearHexagramNumber: 2,
      movingLinePositions: [1],
      changeRuleId: "one_moving",
      direction: "favorable",
      tiYong: { tiTrigram: "gen", yongTrigram: "kan", relation: "yong_generates_ti" },
      quotes: [
        {
          role: "primary",
          hexagramNumber: 24,
          hexagramChineseName: "復",
          label: "Initial Nine",
          text: "Return from a short distance. No need for remorse. Great good fortune.",
          sourceWork: "Zhouyi, Wikisource",
          sourceUrl: "https://zh.wikisource.org/wiki/example",
        },
        {
          role: "supporting",
          hexagramNumber: 2,
          hexagramChineseName: "坤",
          label: "Judgment",
          text: "The receptive brings sublime success.",
          sourceWork: "Zhouyi, Wikisource",
          sourceUrl: "https://zh.wikisource.org/wiki/example-2",
        },
      ],
    },
    generated: {
      verdictEcho: "favorable",
      questionRestatement: "GENERATED-QUESTION",
      oracleApplication: "GENERATED-ORACLE",
      currentStage: "GENERATED-STAGE",
      structuralReading: "GENERATED-STRUCTURE",
      changeMechanism: "GENERATED-CHANGE",
      obstacles: "GENERATED-OBSTACLES",
      turningConditions: "GENERATED-TURNING",
      conditionalGuidance: "GENERATED-GUIDANCE",
      uncertaintyAndBoundaries: "GENERATED-UNCERTAINTY",
    },
    disclaimer: "GENERATED-DISCLAIMER",
    ...overrides,
  };
  return readingReportV2Schema.parse(base);
}

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function text(node: React.ReactElement): string {
  return html(node)
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/&amp;/gu, "&")
    .replace(/\s+/gu, " ")
    .trim();
}

describe("the derived half", () => {
  it("shows the rule-derived facts", () => {
    const rendered = text(<DeterministicHalf report={report()} />);

    expect(rendered).toContain(CHANGE_RULE_TEXT.en.one_moving);
    expect(rendered).toContain(DIRECTION_TEXT.en.favorable);
    expect(rendered).toContain(RELATION_TEXT.en.yong_generates_ti);
    expect(rendered).toContain("Line 1");
  });

  it("names the primary, relating and nuclear hexagrams", () => {
    const rendered = text(<DeterministicHalf report={report()} />);

    expect(rendered).toContain("24 Return");
    expect(rendered).toContain("2 The Receptive");
    expect(rendered).toContain("nuclear");
  });

  it("quotes the classical text with a working source link", () => {
    const rendered = html(<DeterministicHalf report={report()} />);

    expect(rendered).toContain("Return from a short distance");
    expect(rendered).toContain('href="https://zh.wikisource.org/wiki/example"');
    expect(rendered).toContain("Zhouyi, Wikisource");
    // Outbound citations must not pass ranking signals or leak the page.
    expect(rendered).toContain("nofollow");
    expect(rendered).toContain("noopener");
  });

  it("renders in the locale the reading was written in", () => {
    const chinese = text(<DeterministicHalf report={report({ locale: "zh-Hans" })} />);

    expect(chinese).toContain(CHANGE_RULE_TEXT["zh-Hans"].one_moving);
    expect(chinese).toContain(DIRECTION_TEXT["zh-Hans"].favorable);
    expect(chinese).not.toContain(CHANGE_RULE_TEXT.en.one_moving);
  });

  it("says a direction is undetermined instead of leaving it blank", () => {
    const rendered = text(<DeterministicHalf report={report({
      deterministic: { ...report().deterministic, direction: null, tiYong: null },
    })} />);

    expect(rendered).toContain("Not determined");
  });

  it("shows the raw identifier when this build has no wording for it", () => {
    const rendered = text(<DeterministicHalf report={report({
      deterministic: { ...report().deterministic, changeRuleId: "rule_from_a_newer_engine" },
    })} />);

    expect(rendered).toContain("rule_from_a_newer_engine");
  });

  it("contains none of the generated prose", () => {
    expect(text(<DeterministicHalf report={report()} />)).not.toContain("GENERATED-");
  });
});

describe("the generated half", () => {
  it("shows all nine written sections and the disclaimer", () => {
    const rendered = text(<GeneratedHalf report={report()} />);

    for (const marker of [
      "GENERATED-QUESTION", "GENERATED-ORACLE", "GENERATED-STAGE", "GENERATED-STRUCTURE",
      "GENERATED-CHANGE", "GENERATED-OBSTACLES", "GENERATED-TURNING", "GENERATED-GUIDANCE",
      "GENERATED-UNCERTAINTY", "GENERATED-DISCLAIMER",
    ]) {
      expect(rendered).toContain(marker);
    }
  });

  it("contains none of the rule-derived material", () => {
    const rendered = text(<GeneratedHalf report={report()} />);

    expect(rendered).not.toContain(CHANGE_RULE_TEXT.en.one_moving);
    expect(rendered).not.toContain("Return from a short distance");
  });
});

describe("the whole report", () => {
  it("labels which half is computed and which is written", () => {
    const rendered = text(<DeepReadingReport report={report()} />);

    expect(rendered).toContain("Derived by rule");
    expect(rendered).toContain("computed, not written");
    expect(rendered).toContain("Interpretation");
    expect(rendered).toContain("written for your question");
  });

  it("puts the derived half before the interpretation", () => {
    const rendered = text(<DeepReadingReport report={report()} />);

    expect(rendered.indexOf("Derived by rule")).toBeLessThan(rendered.indexOf("GENERATED-QUESTION"));
  });

  it("gives the two halves different containers rather than one flat run of prose", () => {
    const derivedOnly = html(<DeterministicHalf report={report()} />);
    const whole = html(<DeepReadingReport report={report()} />);

    expect(whole).toContain(derivedOnly);
    expect(whole.length).toBeGreaterThan(derivedOnly.length);
  });
});
