import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { getBasicInterpretation } from "@/domain/interpretation/basic";
import type { HexagramInterpretation, HexagramInterpretationBundle, LineInterpretation } from "@/domain/interpretation/v2/types";
import { classicalHexagramByNumber } from "./classical";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
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
  lineType: string;
  changeDirection: string;
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

function fillTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

function summaryForLocalized(
  number: number,
  interpretation: HexagramInterpretation | undefined,
  localizedContent: LocalizedReadingContent,
): PublicHexagramSummary {
  const summary = summaryFor(number, interpretation);
  const localized = localizedContent.hexagrams[number];
  if (!localized) throw new Error(`LOCALIZED_HEXAGRAM_CONTENT_MISSING: ${number}`);
  return {
    ...summary,
    englishName: localized.displayName,
    theme: localized.theme,
    coreMeaning: localized.coreMeaning,
    judgment: localized.judgment,
    image: localized.image,
  };
}

function activeLineFor(
  reading: PublicReading,
  position: number,
  lineInterpretation?: LineInterpretation,
  localizedContent?: LocalizedReadingContent,
): PublicActiveLine {
  const value = reading.lineValuesBottomUp[position - 1];
  if (value !== 6 && value !== 9) throw new Error(`PUBLIC_ACTIVE_LINE_VALUE_MISMATCH: ${position}`);
  const primary = summaryFor(reading.primaryHexagram);
  const direction = localizedContent
    ? value === 6 ? localizedContent.activeLine.yinToYang : localizedContent.activeLine.yangToYin
    : value === 6 ? "yin → yang" : "yang → yin";
  const linePhase = [
    "The first movement changes how the situation takes root.",
    "The second movement changes the way the situation responds.",
    "The third movement changes the hinge between inner and outer conditions.",
    "The fourth movement changes how the situation enters the wider field.",
    "The fifth movement changes the most visible point of responsibility.",
    "The sixth movement changes how the present cycle reaches its edge.",
  ][position - 1];
  if (localizedContent) {
    const phase = localizedContent.linePhases[position - 1];
    return {
      position,
      lineValue: value,
      lineType: value === 6 ? localizedContent.activeLine.oldYin : localizedContent.activeLine.oldYang,
      changeDirection: direction,
      theme: phase,
      meaning: fillTemplate(localizedContent.activeLine.meaningTemplate, { position, phase }),
      caution: value === 6 ? localizedContent.activeLine.oldYinCaution : localizedContent.activeLine.oldYangCaution,
      reflection: fillTemplate(localizedContent.activeLine.reflectionTemplate, { position }),
      href: `${primary.href}#line-${position}`,
    };
  }

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
  localizedContent?: LocalizedReadingContent,
): PublicStaticReading {
  const primary = localizedContent
    ? summaryForLocalized(reading.primaryHexagram, bundles?.primary?.hexagram, localizedContent)
    : summaryFor(reading.primaryHexagram, bundles?.primary?.hexagram);
  const relating = reading.relatingHexagram === null
    ? null
    : localizedContent
      ? summaryForLocalized(reading.relatingHexagram, bundles?.relating?.hexagram, localizedContent)
      : summaryFor(reading.relatingHexagram, bundles?.relating?.hexagram);
  const activeLines = reading.changingLines.map((position) => activeLineFor(reading, position, bundles?.primary?.lines[position - 1], localizedContent));
  const localizedMessages = localizedContent?.messages;
  const changing = activeLines.length === 0
    ? localizedMessages?.noChangingLines ?? "No lines are changing. This reading stays with the primary structure; there is no relating hexagram card."
    : localizedMessages
      ? fillTemplate(localizedMessages.changingLines, {
          positions: activeLines.map((line) => line.position).join(", "),
          relating: relating?.englishName ?? "新的结构",
        })
      : `Changing line${activeLines.length === 1 ? "" : "s"} ${activeLines.map((line) => line.position).join(", ")} show where the primary structure is moving toward ${relating?.chineseName ?? "a new configuration"}.`;
  const direction = relating
    ? localizedMessages
      ? fillTemplate(localizedMessages.directionWithRelating, { primary: primary.englishName, relating: relating.englishName })
      : `${primary.chineseName} opens into ${relating.chineseName}: let the changing lines describe the transition, not a fixed prediction.`
    : localizedMessages?.directionWithoutRelating ?? "With no changing lines, return to the primary image and watch how its counsel meets the actual situation.";

  return {
    reading,
    primary,
    relating,
    activeLines,
    supports: localizedMessages ? localizedMessages.supports : bundles?.primary ? [
      bundles.primary.hexagram.strength,
      bundles.primary.hexagram.orientation,
      `The Judgment frames this structure as: ${primary.judgment}`,
    ] : [
      primary.coreMeaning,
      `The Judgment frames this structure as: ${primary.judgment}`,
      `The Image offers a practice: ${primary.image}`,
    ],
    cautions: localizedMessages ? localizedMessages.cautions : bundles?.primary ? [
      bundles.primary.hexagram.challenge,
      bundles.primary.hexagram.watchFor[0],
      "Keep the reading alongside observable facts and other people's agency; it does not promise an event.",
    ] : [
      "Keep the reading alongside observable facts and other people's agency.",
      "A changing line marks a structural tension; it does not promise an event.",
      "Avoid turning a symbolic pattern into medical, legal, financial, or safety advice.",
    ],
    changing,
    reflections: localizedMessages?.reflections ?? bundles?.primary?.hexagram.reflectionQuestions ?? [
      "What is already true here, before I add a preferred story?",
      "Which small action would make the next step more observable?",
      "What would I want to review after some time has passed?",
    ],
    synthesis: {
      situation: primary.coreMeaning,
      whereChangeIsHappening: localizedMessages
        ? activeLines.length === 0
          ? localizedMessages.whereChangeNone
          : fillTemplate(localizedMessages.whereChangeSome, { items: activeLines.map((line) => line.position).join("、") })
        : activeLines.length === 0
          ? "No moving line was recorded; the emphasis remains on the primary structure."
          : activeLines.map((line) => `Line ${line.position}: ${line.theme}`).join(" · "),
      directionOfChange: localizedMessages
        ? direction
        : bundles?.primary
        ? activeLines.length > 0
          ? bundles.primary.hexagram.transitionTheme
          : bundles.primary.hexagram.stabilityTheme
        : direction,
      bottomLine: localizedMessages
        ? relating
          ? fillTemplate(localizedMessages.bottomWithRelating, { primary: primary.englishName, relating: relating.englishName })
          : localizedMessages.bottomNoRelating.replaceAll("{primary}", primary.englishName)
        : relating
          ? `Use ${primary.chineseName} to understand the present pattern and ${relating.chineseName} to reflect on the direction of change.`
          : `Use ${primary.chineseName} as a stable frame for observation and deliberate action.`,
    },
  };
}
