import type { CastingRepository } from "../casting-repository";
import type {
  HistoryPage,
  HistoryQuery,
  HistoryRecord,
  HistoryRepository,
} from "../history-repository";
import { snapshot } from "./snapshot";
import type { MemoryStore } from "./store";

export class MemoryHistoryRepository implements HistoryRepository {
  constructor(
    private readonly store: MemoryStore,
    private readonly castingRepository: CastingRepository,
  ) {}

  queryHistory(input: HistoryQuery): HistoryPage {
    const matching = [...this.store.castingSessions.values()]
      .filter((casting) => casting.userId === input.userId)
      .filter((casting) => !casting.deletedAt && casting.lifecycle !== "discarded_duplicate")
      .filter((casting) => !input.method || casting.method === input.method)
      .filter((casting) => !input.scene || casting.scene === input.scene)
      .filter((casting) => {
        const preview = this.store.previews.get(casting.id);
        return input.hasPreview === undefined || (preview?.status === "completed") === input.hasPreview;
      })
      .filter((casting) => {
        const reading = [...this.store.readings.values()]
          .find((candidate) => candidate.castingSessionId === casting.id);
        return input.hasReading === undefined || (reading?.status === "completed") === input.hasReading;
      })
      .filter((casting) => {
        if (!input.after) return true;
        const createdAt = casting.createdAt.getTime();
        const cursorAt = input.after.createdAt.getTime();
        return createdAt < cursorAt || (createdAt === cursorAt && casting.id < input.after.castingId);
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()
        || right.id.localeCompare(left.id));

    const selected = matching.slice(0, input.limit + 1);
    const hasNext = selected.length > input.limit;
    const pageSessions = selected.slice(0, input.limit);
    const items = pageSessions.map((casting): HistoryRecord => {
      const result = this.castingRepository.getCastResult(casting.id);
      const preview = this.store.previews.get(casting.id);
      const reading = [...this.store.readings.values()]
        .find((candidate) => candidate.castingSessionId === casting.id);
      const review = reading
        ? [...this.store.qualityReviews.values()].find((candidate) => candidate.readingId === reading.id)
        : undefined;
      const entitlementChanges = reading
        ? this.store.entitlementLedger.filter((entry) => entry.readingId === reading.id || entry.reviewId === review?.id)
        : review
          ? this.store.entitlementLedger.filter((entry) => entry.reviewId === review.id)
          : [];
      return {
        castingId: casting.id,
        method: casting.method,
        scene: casting.scene,
        interpretationGoal: casting.interpretationGoal,
        lifecycle: casting.lifecycle,
        riskStatus: casting.riskStatus,
        createdAt: new Date(casting.createdAt),
        questionContext: this.castingRepository.getLatestQuestionContext(casting.id),
        result: result ? {
          lineValues: [...result.lineValues],
          primaryHexagramNumber: result.primaryHexagramNumber,
          movingLinePositions: [...result.movingLinePositions],
          relatingHexagramNumber: result.relatingHexagramNumber,
          methodCalculation: snapshot(result.methodCalculation),
          algorithmVersion: result.algorithmVersion,
          classicMappingVersion: result.classicMappingVersion,
        } : null,
        previewStatus: preview?.status ?? null,
        readingId: reading?.id ?? null,
        readingStatus: reading?.status ?? null,
        entitlementChanges: snapshot(entitlementChanges),
        qualityReview: review ? {
          status: review.status,
          compensationBatchId: review.compensationBatchId,
        } : null,
      };
    });
    const last = pageSessions.at(-1);
    return {
      items: snapshot(items),
      next: hasNext && last
        ? { createdAt: new Date(last.createdAt), castingId: last.id }
        : null,
    };
  }
}
