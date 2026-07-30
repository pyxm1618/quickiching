import type { LedgerEntry } from "@/domain/entitlements/batch";
import type {
  CastingLifecycle,
  CastingMethod,
  InterpretationGoal,
  LineValue,
  QualityReviewStatus,
  RiskStatus,
  Scene,
} from "@/domain/casting/types";

export type HistoryCursor = {
  createdAt: Date;
  castingId: string;
};

export type HistoryQuery = {
  userId: string;
  limit: number;
  after?: HistoryCursor;
  method?: CastingMethod;
  scene?: Scene;
  hasPreview?: boolean;
  hasReading?: boolean;
};

export type HistoryRecord = {
  castingId: string;
  method: CastingMethod;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  lifecycle: CastingLifecycle;
  riskStatus: RiskStatus;
  createdAt: Date;
  questionContext: string;
  result: {
    lineValues: LineValue[];
    primaryHexagramNumber: number;
    movingLinePositions: number[];
    relatingHexagramNumber: number | null;
    methodCalculation: unknown;
    algorithmVersion: string;
    classicMappingVersion: string;
  } | null;
  previewStatus: string | null;
  readingId: string | null;
  readingStatus: string | null;
  entitlementChanges: LedgerEntry[];
  qualityReview: {
    status: QualityReviewStatus;
    compensationBatchId: string | null;
  } | null;
};

export type HistoryPage = {
  items: HistoryRecord[];
  next: HistoryCursor | null;
};

export interface HistoryRepository {
  queryHistory(input: HistoryQuery): HistoryPage;
}
