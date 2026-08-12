import type { HexagramDef } from "@/domain/casting/hexagrams/king-wen";
import type { HexagramResult, LineValue } from "@/domain/casting/types";

export type LinePosition = 1 | 2 | 3 | 4 | 5 | 6;

export type HexagramInterpretation = {
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
};

export type LineInterpretation = {
  hexagramNumber: number;
  position: LinePosition;
  theme: string;
  meaning: string;
  changeDynamic: string;
  caution: string;
  reflection: string;
  synthesisPhrase: string;
};

export type HexagramInterpretationBundle = {
  hexagram: HexagramInterpretation;
  lines: readonly [
    LineInterpretation,
    LineInterpretation,
    LineInterpretation,
    LineInterpretation,
    LineInterpretation,
    LineInterpretation,
  ];
};

export type ActiveLineInterpretation = LineInterpretation & {
  lineValue: 6 | 9;
  changeDirection: "yin → yang" | "yang → yin";
  lineType: "Old yin" | "Old yang";
};

export type ReadingSynthesis = {
  situation: string;
  whereChangeIsHappening: string;
  directionOfChange: string;
  bottomLine: string;
};

export type FreeReading = {
  result: HexagramResult;
  primary: HexagramDef;
  primaryInterpretation: HexagramInterpretation;
  activeLines: readonly ActiveLineInterpretation[];
  relating: HexagramDef | null;
  relatingInterpretation: HexagramInterpretation | null;
  synthesis: ReadingSynthesis;
};

export function isMovingLineValue(value: LineValue): value is 6 | 9 {
  return value === 6 || value === 9;
}
