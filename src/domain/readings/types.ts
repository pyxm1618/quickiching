// §11.2 Deep Reading schema (READ-002). All ten prose modules are always present, even when
// the reading variant changes module 4/5 titles (READ-004). Controlled source references are
// supporting evidence for module 10, not a substitute for its explanatory text.

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
