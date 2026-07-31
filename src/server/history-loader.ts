import { getCurrentUser } from "@/lib/auth/session";
import { castingRepository, privacyRepository, readingRepository } from "@/server/repository";
import { HistoryService, type HistoryFilter } from "@/server/services/history-service";

const historyService = new HistoryService({
  privacyRepository,
  castingRepository,
  readingRepository,
});

export type AccountHistoryItem = {
  id: string;
  method: string;
  scene: string;
  lifecycle: string;
  riskStatus: string;
  createdAt: Date;
  primaryName: string | null;
  primaryHexagramNumber: number | null;
  movingLinePositions: number[];
  relatingHexagramNumber: number | null;
  algorithmVersion: string | null;
  classicMappingVersion: string | null;
  methodCalculation: Record<string, unknown> | null;
  hasPreview: boolean;
  hasReading: boolean;
  previewStatus: string | null;
  readingId: string | null;
  readingStatus: string | null;
  reviewStatus: string | null;
  reservationStatus: string | null;
  entitlementExpiresAt: Date | null;
};

export async function loadAccountHistoryPage(input: {
  filter: HistoryFilter;
  cursor?: string;
  limit?: number;
}): Promise<{ items: AccountHistoryItem[]; nextCursor: string | null }> {
  const user = await getCurrentUser();
  if (!user) return { items: [], nextCursor: null };

  if (process.env.NODE_ENV === "production") {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const page = await production.history.list({
      userId: user.id,
      filter: {
        ...input.filter,
        cursor: input.cursor,
        limit: input.limit,
      },
    });
    return {
      items: page.items.map((item) => ({
        id: item.id,
        method: item.method,
        scene: item.scene,
        lifecycle: item.lifecycle,
        riskStatus: item.riskStatus,
        createdAt: item.createdAt,
        primaryName: item.primaryName,
        primaryHexagramNumber: item.primaryHexagramNumber,
        movingLinePositions: item.movingLinePositions,
        relatingHexagramNumber: item.relatingHexagramNumber,
        algorithmVersion: item.algorithmVersion,
        classicMappingVersion: item.classicMappingVersion,
        methodCalculation: item.methodCalculation,
        hasPreview: item.previewStatus === "completed",
        hasReading: item.readingStatus === "completed",
        previewStatus: item.previewStatus,
        readingId: item.readingId,
        readingStatus: item.readingStatus,
        reviewStatus: item.reviewStatus,
        reservationStatus: item.reservationStatus,
        entitlementExpiresAt: item.entitlementExpiresAt,
      })),
      nextCursor: page.nextCursor,
    };
  }

  const items = historyService.list(user.id, input.filter).map((item) => ({
    ...item,
    primaryHexagramNumber: null,
    movingLinePositions: [],
    relatingHexagramNumber: null,
    algorithmVersion: null,
    classicMappingVersion: null,
    methodCalculation: null,
    previewStatus: item.hasPreview ? "completed" : null,
    readingId: null,
    readingStatus: item.hasReading ? "completed" : null,
    reviewStatus: null,
    reservationStatus: null,
    entitlementExpiresAt: null,
  }));
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
  return { items: items.slice(0, limit), nextCursor: null };
}
