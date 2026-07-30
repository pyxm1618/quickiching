import type { CastingMethod, Scene } from "@/domain/casting/types";
import { DomainError } from "@/server/errors/domain-error";
import type { HistoryCursor, HistoryRepository } from "@/server/repositories/history-repository";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type HistoryFilter = {
  method?: CastingMethod;
  scene?: Scene;
  hasPreview?: boolean;
  hasReading?: boolean;
};

type HistoryPageInput = HistoryFilter & {
  cursor?: string | null;
  limit?: number;
};

function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify({
    v: 1,
    createdAt: cursor.createdAt.toISOString(),
    castingId: cursor.castingId,
  }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null | undefined): HistoryCursor | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Record<string, unknown>;
    if (value.v !== 1 || typeof value.createdAt !== "string" || typeof value.castingId !== "string") {
      throw new Error("invalid");
    }
    const createdAt = new Date(value.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== value.createdAt || !value.castingId) {
      throw new Error("invalid");
    }
    return { createdAt, castingId: value.castingId };
  } catch {
    throw new DomainError("HISTORY_CURSOR_INVALID", "The history cursor is invalid.", false, "cursor");
  }
}

export class HistoryService {
  constructor(private readonly dependencies: {
    historyRepository: HistoryRepository;
  }) {}

  listPage(userId: string, input: HistoryPageInput = {}) {
    const limit = input.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new DomainError(
        "HISTORY_PAGE_SIZE_INVALID",
        `History page size must be between 1 and ${MAX_PAGE_SIZE}.`,
        false,
        "limit",
      );
    }
    const page = this.dependencies.historyRepository.queryHistory({
      userId,
      limit,
      after: decodeCursor(input.cursor),
      method: input.method,
      scene: input.scene,
      hasPreview: input.hasPreview,
      hasReading: input.hasReading,
    });
    return {
      items: page.items,
      nextCursor: page.next ? encodeCursor(page.next) : null,
    };
  }

  list(userId: string, filters: HistoryFilter) {
    return this.listPage(userId, { ...filters, limit: MAX_PAGE_SIZE }).items;
  }
}
