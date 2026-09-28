// Compatibility types for the retired local report generator used by the disabled legacy
// commercial action path. Current Deep Reading output is defined in deep-reading-contract.ts.

export type ReadingVariant =
  | "standard"
  | "still_hexagram" // no moving lines
  | "multiple_moving"
  | "all_lines_moving"; // six lines all moving

export type InterpretiveBasisReference = {
  // We do NOT generate classic text (G-02 licensing blocked). References describe which
  // controlled source the production renderer would pull, and are auditable.
  source: "king_wen_judgment" | "king_wen_line" | "relating_judgment";
  hexagramNumber: number;
  linePosition?: number;
  status: "pending_license";
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
  interpretiveBasisReferences: InterpretiveBasisReference[];
};

export type PreviewOutput = {
  relevanceStatement: string;
};
