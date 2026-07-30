import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { CastingMethod, Scene } from "@/domain/casting/types";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { PrivacyRepository } from "@/server/repositories/privacy-repository";
import type { ReadingRepository } from "@/server/repositories/reading-repository";

export type HistoryFilter = {
  method?: CastingMethod;
  scene?: Scene;
  hasPreview?: boolean;
  hasReading?: boolean;
};

export class HistoryService {
  constructor(private readonly dependencies: {
    privacyRepository: PrivacyRepository;
    castingRepository: CastingRepository;
    readingRepository: ReadingRepository;
  }) {}

  list(userId: string, filter: HistoryFilter) {
    return this.dependencies.privacyRepository.listCastsForUser(userId)
      .map((session) => {
        const result = this.dependencies.castingRepository.getCastResult(session.id);
        const preview = this.dependencies.readingRepository.getPreview(session.id);
        const reading = this.dependencies.readingRepository.getReadingByCasting(session.id);
        return {
          id: session.id,
          method: session.method,
          scene: session.scene,
          lifecycle: session.lifecycle,
          riskStatus: session.riskStatus,
          createdAt: session.createdAt,
          primaryName: result ? hexagramByNumber(result.primaryHexagramNumber).englishName : null,
          hasPreview: preview?.status === "completed",
          hasReading: reading?.status === "completed",
        };
      })
      .filter((item) => filter.method === undefined || item.method === filter.method)
      .filter((item) => filter.scene === undefined || item.scene === filter.scene)
      .filter((item) => filter.hasPreview === undefined || item.hasPreview === filter.hasPreview)
      .filter((item) => filter.hasReading === undefined || item.hasReading === filter.hasReading);
  }
}
