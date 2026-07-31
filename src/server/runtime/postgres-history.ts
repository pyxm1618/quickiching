import type { Sql } from "postgres";
import type { CastingMethod, Scene } from "@/domain/casting/types";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { DomainError } from "@/server/errors/domain-error";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type HistoryCursor = { createdAt: Date; id: string };

export type PostgresHistoryFilter = {
  method?: CastingMethod;
  scene?: Scene;
  hasPreview?: boolean;
  hasReading?: boolean;
  cursor?: string;
  limit?: number;
};

export type PostgresHistoryItem = {
  id: string;
  method: CastingMethod;
  scene: Scene;
  lifecycle: string;
  riskStatus: string;
  createdAt: Date;
  primaryHexagramNumber: number | null;
  primaryName: string | null;
  movingLinePositions: number[];
  relatingHexagramNumber: number | null;
  algorithmVersion: string | null;
  classicMappingVersion: string | null;
  methodCalculation: Record<string, unknown> | null;
  previewStatus: string | null;
  readingId: string | null;
  readingStatus: string | null;
  reviewStatus: string | null;
  reservationStatus: string | null;
  entitlementExpiresAt: Date | null;
};

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function decodeCursor(value: string | undefined): HistoryCursor | null {
  if (!value) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const separator = decoded.indexOf("|");
    if (separator <= 0) throw new Error("invalid");
    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (Number.isNaN(createdAt.getTime()) || !/^[A-Za-z0-9_-]{3,160}$/.test(id)) {
      throw new Error("invalid");
    }
    return { createdAt, id };
  } catch {
    throw new DomainError("HISTORY_CURSOR_INVALID", "The history cursor is invalid.", false, "cursor");
  }
}

function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`, "utf8").toString("base64url");
}

export class PostgresHistoryService {
  constructor(private readonly database: Sql) {}

  async list(input: {
    userId: string;
    filter?: PostgresHistoryFilter;
  }): Promise<{ items: PostgresHistoryItem[]; nextCursor: string | null }> {
    const filter = input.filter ?? {};
    const cursor = decodeCursor(filter.cursor);
    const limit = Math.max(1, Math.min(filter.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE));
    const method = filter.method ?? null;
    const scene = filter.scene ?? null;
    const hasPreview = filter.hasPreview ?? null;
    const hasReading = filter.hasReading ?? null;
    const cursorAt = cursor?.createdAt ?? null;
    const cursorId = cursor?.id ?? null;

    const rows = await this.database`
      select
        c.id, c.method, c.scene, c.lifecycle, c.risk_status, c.created_at,
        r.primary_hexagram_number, r.moving_line_positions, r.relating_hexagram_number,
        r.algorithm_version, r.classic_mapping_version, r.method_calculation,
        p.status as preview_status,
        rd.id as reading_id, rd.status as reading_status,
        qr.status as review_status,
        res.status as reservation_status,
        eb.expires_at as entitlement_expires_at
      from casting_sessions c
      left join cast_results r on r.casting_session_id = c.id
      left join previews p on p.casting_session_id = c.id
      left join readings rd on rd.casting_session_id = c.id
      left join quality_reviews qr on qr.reading_id = rd.id
      left join reservations res on res.id = rd.reservation_id
      left join entitlement_batches eb on eb.id = res.batch_id
      where c.user_id = ${input.userId}
        and c.deleted_at is null
        and c.lifecycle not in ('discarded_duplicate', 'user_deleted')
        and (${method}::text is null or c.method = ${method}::text)
        and (${scene}::text is null or c.scene = ${scene}::text)
        and (${hasPreview}::boolean is null or (p.status = 'completed') = ${hasPreview}::boolean)
        and (${hasReading}::boolean is null or (rd.status = 'completed') = ${hasReading}::boolean)
        and (
          ${cursorAt}::timestamptz is null
          or (c.created_at, c.id) < (${cursorAt}::timestamptz, ${cursorId}::text)
        )
      order by c.created_at desc, c.id desc
      limit ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const items = visible.map((row): PostgresHistoryItem => {
      const primaryNumber = row.primary_hexagram_number == null
        ? null
        : Number(row.primary_hexagram_number);
      return {
        id: String(row.id),
        method: row.method as CastingMethod,
        scene: row.scene as Scene,
        lifecycle: String(row.lifecycle),
        riskStatus: String(row.risk_status),
        createdAt: asDate(row.created_at),
        primaryHexagramNumber: primaryNumber,
        primaryName: primaryNumber == null ? null : hexagramByNumber(primaryNumber).englishName,
        movingLinePositions: Array.isArray(row.moving_line_positions)
          ? row.moving_line_positions.map(Number)
          : [],
        relatingHexagramNumber: row.relating_hexagram_number == null
          ? null
          : Number(row.relating_hexagram_number),
        algorithmVersion: row.algorithm_version == null ? null : String(row.algorithm_version),
        classicMappingVersion: row.classic_mapping_version == null
          ? null
          : String(row.classic_mapping_version),
        methodCalculation: row.method_calculation && typeof row.method_calculation === "object"
          ? row.method_calculation as Record<string, unknown>
          : null,
        previewStatus: row.preview_status == null ? null : String(row.preview_status),
        readingId: row.reading_id == null ? null : String(row.reading_id),
        readingStatus: row.reading_status == null ? null : String(row.reading_status),
        reviewStatus: row.review_status == null ? null : String(row.review_status),
        reservationStatus: row.reservation_status == null ? null : String(row.reservation_status),
        entitlementExpiresAt: row.entitlement_expires_at == null
          ? null
          : asDate(row.entitlement_expires_at),
      };
    });
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
    };
  }
}
