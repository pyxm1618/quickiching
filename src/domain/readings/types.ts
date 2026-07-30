// §12.5 Deep Reading schema (READ-002). All ten narrative modules are always present, even
// when the reading variant changes module 4/5 titles (READ-004). Controlled source references
// support the visible Interpretive Basis module but do not replace it.

export type ReadingVariant =
  | "standard"
  | "still_hexagram"
  | "multiple_moving"
  | "all_lines_moving";

export type InterpretiveBasisReference = {
  referenceId: string;
  sourceVersion: "legge-1899-v1";
  hexagramNumber: number;
  linePosition?: number;
  kind: "judgment" | "line" | "relating_judgment";
};

export type ReadingReport = {
  readingVariant: ReadingVariant;
  coreSummary: string;
  currentStage: string;
  primaryHexagramPattern: string;
  changeMechanism: string;
  possibleDirection: string;
  obstaclesAndBlindSpots: string;
  turningConditions: string;
  conditionalActionDirection: string;
  uncertaintyAndBoundaries: string;
  interpretiveBasis: string;
  interpretiveBasisReferences: InterpretiveBasisReference[];
};

export type PreviewOutput = {
  relevanceStatement: string;
};
