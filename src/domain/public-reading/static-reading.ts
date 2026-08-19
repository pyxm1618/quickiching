import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { getBasicInterpretation } from "@/domain/interpretation/basic";
import type { HexagramInterpretation, HexagramInterpretationBundle, LineInterpretation } from "@/domain/interpretation/v2/types";
import { classicalHexagramByNumber } from "./classical";
import type { PublicReading } from "./types";

export type PublicHexagramSummary = {
  number: number;
  slug: string;
  englishName: string;
  chineseName: string;
  pinyin: string;
  symbol: string;
  lowerTrigram: string;
  upperTrigram: string;
  theme: string;
  coreMeaning: string;
  judgment: string;
  image: string;
  href: string;
};

export type PublicActiveLine = {
  position: number;
  lineValue: 6 | 9;
  lineType: "Old yin" | "Old yang";
  changeDirection: "yin → yang" | "yang → yin";
  theme: string;
  meaning: string;
  caution: string;
  reflection: string;
  href: string;
};

export type PublicStaticReading = {
  reading: PublicReading;
  primary: PublicHexagramSummary;
  relating: PublicHexagramSummary | null;
  activeLines: readonly PublicActiveLine[];
  supports: readonly [string, string, string];
  cautions: readonly [string, string, string];
  changing: string;
  reflections: readonly [string, string, string];
  synthesis: {
    situation: string;
    whereChangeIsHappening: string;
    directionOfChange: string;
    bottomLine: string;
  };
};

function summaryFor(number: number, interpretation?: HexagramInterpretation): PublicHexagramSummary {
  const classical = classicalHexagramByNumber(number);
  const definition = hexagramByNumber(number);
  const fallback = getBasicInterpretation(number);
  return {
    number,
    slug: classical.slug,
    englishName: definition.englishName,
    chineseName: classical.chineseName,
    pinyin: classical.pinyin,
    symbol: classical.symbol,
    lowerTrigram: classical.trigrams.lower,
    upperTrigram: classical.trigrams.upper,
    theme: interpretation?.coreTheme ?? fallback.theme,
    coreMeaning: interpretation?.coreMeaning ?? fallback.summary,
    judgment: classical.judgment,
    image: classical.image,
    href: `/hexagrams/${classical.slug}`,
  };
}

function activeLineFor(reading: PublicReading, position: number, lineInterpretation?: LineInterpretation): PublicActiveLine {
  const value = reading.lineValuesBottomUp[position - 1];
  if (value !== 6 && value !== 9) throw new Error(`PUBLIC_ACTIVE_LINE_VALUE_MISMATCH: ${position}`);
  const primary = summaryFor(reading.primaryHexagram);
  const direction = value === 6 ? "yin → yang" : "yang → yin";
  const linePhase = [
    "The first movement changes how the situation takes root.",
    "The second movement changes the way the situation responds.",
    "The third movement changes the hinge between inner and outer conditions.",
    "The fourth movement changes how the situation enters the wider field.",
    "The fifth movement changes the most visible point of responsibility.",
    "The sixth movement changes how the present cycle reaches its edge.",
  ][position - 1];
  return {
    position,
    lineValue: value,
    lineType: value === 6 ? "Old yin" : "Old yang",
    changeDirection: direction,
    theme: lineInterpretation?.theme ?? `${primary.chineseName} line ${position} · ${direction}`,
    meaning: lineInterpretation?.meaning ?? `${linePhase} Read it with the primary hexagram's core meaning: ${primary.coreMeaning}`,
    caution: lineInterpretation?.caution ?? (value === 6
      ? "A receptive pattern is opening into action; do not confuse movement with certainty."
      : "A forceful pattern is changing into receptivity; do not treat momentum as permission to overreach."),
    reflection: lineInterpretation?.reflection ?? `What evidence would show that line ${position}'s change is being handled with proportion?`,
    href: `${primary.href}#line-${position}`,
  };
}

export function buildStaticReading(
  reading: PublicReading,
  bundles?: { primary?: HexagramInterpretationBundle; relating?: HexagramInterpretationBundle | null },
): PublicStaticReading {
  const primary = summaryFor(reading.primaryHexagram, bundles?.primary?.hexagram);
  const relating = reading.relatingHexagram === null ? null : summaryFor(reading.relatingHexagram, bundles?.relating?.hexagram);
  const activeLines = reading.changingLines.map((position) => activeLineFor(reading, position, bundles?.primary?.lines[position - 1]));
  const changing = activeLines.length === 0
    ? "No lines are changing. This reading stays with the primary structure; there is no relating hexagram card."
    : `Changing line${activeLines.length === 1 ? "" : "s"} ${activeLines.map((line) => line.position).join(", ")} show where the primary structure is moving toward ${relating?.chineseName ?? "a new configuration"}.`;
  const direction = relating
    ? `${primary.chineseName} opens into ${relating.chineseName}: let the changing lines describe the transition, not a fixed prediction.`
    : "With no changing lines, return to the primary image and watch how its counsel meets the actual situation.";

  return {
    reading,
    primary,
    relating,
    activeLines,
    supports: bundles?.primary ? [
      bundles.primary.hexagram.strength,
      bundles.primary.hexagram.orientation,
      `The Judgment frames this structure as: ${primary.judgment}`,
    ] : [
      primary.coreMeaning,
      `The Judgment frames this structure as: ${primary.judgment}`,
      `The Image offers a practice: ${primary.image}`,
    ],
    cautions: bundles?.primary ? [
      bundles.primary.hexagram.challenge,
      bundles.primary.hexagram.watchFor[0],
      "Keep the reading alongside observable facts and other people's agency; it does not promise an event.",
    ] : [
      "Keep the reading alongside observable facts and other people's agency.",
      "A changing line marks a structural tension; it does not promise an event.",
      "Avoid turning a symbolic pattern into medical, legal, financial, or safety advice.",
    ],
    changing,
    reflections: bundles?.primary?.hexagram.reflectionQuestions ?? [
      "What is already true here, before I add a preferred story?",
      "Which small action would make the next step more observable?",
      "What would I want to review after some time has passed?",
    ],
    synthesis: {
      situation: primary.coreMeaning,
      whereChangeIsHappening: activeLines.length === 0
        ? "No moving line was recorded; the emphasis remains on the primary structure."
        : activeLines.map((line) => `Line ${line.position}: ${line.theme}`).join(" · "),
      directionOfChange: bundles?.primary
        ? activeLines.length > 0
          ? bundles.primary.hexagram.transitionTheme
          : bundles.primary.hexagram.stabilityTheme
        : direction,
      bottomLine: relating
        ? `Use ${primary.chineseName} to understand the present pattern and ${relating.chineseName} to reflect on the direction of change.`
        : `Use ${primary.chineseName} as a stable frame for observation and deliberate action.`,
    },
  };
}
