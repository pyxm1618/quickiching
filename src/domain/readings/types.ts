// §12.5 Deep Reading schema (READ-002). All ten modules are always present, even when the
// reading variant changes module 4/5 titles (READ-004). Personalization is a minimum quality
// bar for every module, not a separate field.

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
