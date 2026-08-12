import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import type { HexagramInterpretationBundle, LineInterpretation, LinePosition } from "./types";

export type AuthoredLineContent = Omit<LineInterpretation, "hexagramNumber" | "position">;

export type HexagramInterpretationProfile = {
  number: number;
  coreTheme: string;
  coreMeaning: string;
  strength: string;
  challenge: string;
  orientation: string;
  structureInterpretation: string;
  reflectionQuestions: readonly [string, string, string];
  watchFor: readonly [string, string, string];
  transitionTheme: string;
  stabilityTheme: string;
  lowerTrigram: Trigram;
  upperTrigram: Trigram;
  lines: readonly [
    AuthoredLineContent,
    AuthoredLineContent,
    AuthoredLineContent,
    AuthoredLineContent,
    AuthoredLineContent,
    AuthoredLineContent,
  ];
};

function sentenceCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (/[.!?]$/.test(trimmed)) return sentenceCase(trimmed);
  return `${sentenceCase(trimmed)}.`;
}

export function authoredLine(
  theme: string,
  meaning: string,
  changeDynamic: string,
  caution: string,
  reflection: string,
  synthesisPhrase: string,
): AuthoredLineContent {
  return { theme, meaning, changeDynamic, caution, reflection, synthesisPhrase };
}

function authoredLines(profile: HexagramInterpretationProfile): HexagramInterpretationBundle["lines"] {
  return profile.lines.map((line, index) => ({
    hexagramNumber: profile.number,
    position: (index + 1) as LinePosition,
    ...line,
  })) as unknown as HexagramInterpretationBundle["lines"];
}

export function buildInterpretationBundle(profile: HexagramInterpretationProfile): HexagramInterpretationBundle {
  if (!Number.isInteger(profile.number) || profile.number < 1 || profile.number > 64) {
    throw new Error(`HEXAGRAM_INTERPRETATION_INVALID_NUMBER: number=${profile.number}`);
  }
  return {
    hexagram: {
      number: profile.number,
      coreTheme: profile.coreTheme,
      coreMeaning: profile.coreMeaning,
      strength: sentence(profile.strength),
      challenge: sentence(profile.challenge),
      orientation: sentence(profile.orientation),
      structureInterpretation: profile.structureInterpretation,
      reflectionQuestions: profile.reflectionQuestions,
      watchFor: profile.watchFor,
      transitionTheme: sentence(profile.transitionTheme),
      stabilityTheme: sentence(profile.stabilityTheme),
    },
    lines: authoredLines(profile),
  };
}

export function buildInterpretationCatalog(
  profiles: readonly HexagramInterpretationProfile[],
): Record<number, HexagramInterpretationBundle> {
  const entries = profiles.map((profile) => [profile.number, buildInterpretationBundle(profile)] as const);
  const catalog = Object.fromEntries(entries) as Record<number, HexagramInterpretationBundle>;
  if (Object.keys(catalog).length !== profiles.length) {
    throw new Error("HEXAGRAM_INTERPRETATION_DUPLICATE_NUMBER");
  }
  return catalog;
}
