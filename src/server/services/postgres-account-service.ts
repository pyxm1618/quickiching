import { randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { decryptJson } from "@/lib/crypto";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import type { CastingMethod, RiskStatus, Scene } from "@/domain/casting/types";
import type { CastingSession } from "@/server/repositories/models";
import type { CastingView } from "@/server/loaders";
import type { HistoryFilter } from "@/server/services/history-service";
import { DomainError } from "@/server/errors/domain-error";

const DAY_MS = 24 * 60 * 60 * 1000;
type Row = Record<string, unknown>;

function id(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function date(value: unknown): Date | null {
  return value == null ? null : new Date(String(value));
}

function mapSession(row: Row): CastingSession {
  return {
    id: String(row.id),
    userId: row.user_id == null ? null : String(row.user_id),
    anonymousSessionHash: row.anonymous_session_hash == null ? null : String(row.anonymous_session_hash),
    anonymousHashKeyVersion: row.anonymous_hash_key_version == null ? null : String(row.anonymous_hash_key_version),
    method: row.method as CastingMethod,
    lifecycle: row.lifecycle as CastingSession["lifecycle"],
    riskStatus: row.risk_status as RiskStatus,
    scene: row.scene as CastingSession["scene"],
    interpretationGoal: row.interpretation_goal as CastingSession["interpretationGoal"],
    currentQuestionVersionId: row.current_question_version_id == null ? null : String(row.current_question_version_id),
    questionFingerprint: row.question_fingerprint == null ? null : String(row.question_fingerprint),
    fingerprintKeyVersion: row.fingerprint_key_version == null ? null : String(row.fingerprint_key_version),
    algorithmVersion: String(row.algorithm_version),
    firstIrreversibleStepAt: date(row.first_irreversible_step_at),
    castingExpiresAt: date(row.casting_expires_at),
    completedAt: date(row.completed_at),
    revealExpiresAt: date(row.reveal_expires_at),
    revealedAt: date(row.revealed_at),
    duplicateOfCastingId: row.duplicate_of_casting_id == null ? null : String(row.duplicate_of_casting_id),
    deletedAt: date(row.deleted_at),
    purgeAfter: date(row.purge_after),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export class PostgresAccountApplicationService {
  constructor(private readonly sql: Sql) {}

  async loadCastingView(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<CastingView | null> {
    const [casting] = await this.sql`select * from casting_sessions where id = ${input.castingId}`;
    if (!casting || casting.deleted_at) return null;
    const owns = input.userId != null
      ? casting.user_id === input.userId
      : input.anonymousSessionHash != null && casting.anonymous_session_hash === input.anonymousSessionHash;
    if (!owns) return null;
    const canRead = casting.lifecycle === "revealed" && input.userId != null && casting.user_id === input.userId;
    const [result] = canRead ? await this.sql`select * from cast_results where casting_session_id = ${input.castingId}` : [];
    const [preview] = canRead ? await this.sql`select * from previews where casting_session_id = ${input.castingId}` : [];
    const [reading] = canRead ? await this.sql`select * from readings where casting_session_id = ${input.castingId}` : [];
    const steps = await this.sql`
      select step_kind, line_index, change_index, line_value
      from casting_steps where casting_session_id = ${input.castingId}
      order by line_index, change_index nulls first
    `;
    let context = "";
    if (canRead && casting.current_question_version_id) {
      const [question] = await this.sql`
        select * from question_versions where id = ${casting.current_question_version_id}
      `;
      if (question) {
        context = decryptJson<{ context: string }>({
          v: String(question.encryption_key_version),
          iv: String(question.iv),
          tag: String(question.auth_tag),
          data: String(question.ciphertext),
        }, "context", `${input.castingId}:${question.id}`).context;
      }
    }
    const castingExpired = date(casting.casting_expires_at)?.getTime()! <= input.now.getTime();
    const revealExpired = date(casting.reveal_expires_at)?.getTime()! <= input.now.getTime();
    return {
      session: mapSession(casting),
      owns,
      isAuthed: input.userId != null,
      context,
      result: result ? {
        primaryHexagramNumber: Number(result.primary_hexagram_number),
        primaryName: hexagramByNumber(Number(result.primary_hexagram_number)).englishName,
        movingLinePositions: result.moving_line_positions as number[],
        relatingHexagramNumber: result.relating_hexagram_number == null ? null : Number(result.relating_hexagram_number),
        relatingName: result.relating_hexagram_number == null
          ? null
          : hexagramByNumber(Number(result.relating_hexagram_number)).englishName,
        lineValues: result.line_values as number[],
        algorithmVersion: String(result.algorithm_version),
        classicMappingVersion: String(result.classic_mapping_version),
      } : null,
      preview: preview ? {
        status: String(preview.status),
        relevanceStatement: preview.relevance_statement == null ? null : String(preview.relevance_statement),
      } : null,
      reading: reading ? {
        status: String(reading.status),
        report: reading.report as Record<string, unknown> | null,
        id: String(reading.id),
      } : null,
      steps: steps.map((step) => ({
        stepKind: String(step.step_kind),
        lineIndex: Number(step.line_index),
        changeIndex: step.change_index == null ? null : Number(step.change_index),
        lineValue: step.line_value == null ? null : Number(step.line_value),
      })),
      clocks: { castingExpired, revealExpired },
    };
  }

  async history(userId: string, filter: HistoryFilter = {}) {
    const conditions: string[] = ["c.user_id = $1", "c.deleted_at is null", "c.lifecycle <> 'discarded_duplicate'"];
    const values: unknown[] = [userId];
    if (filter.method) {
      values.push(filter.method);
      conditions.push(`c.method = $${values.length}`);
    }
    if (filter.scene) {
      values.push(filter.scene);
      conditions.push(`c.scene = $${values.length}`);
    }
    if (filter.hasPreview !== undefined) {
      conditions.push(filter.hasPreview ? "p.status = 'completed'" : "coalesce(p.status, 'not_started') <> 'completed'");
    }
    if (filter.hasReading !== undefined) {
      conditions.push(filter.hasReading ? "r.status = 'completed'" : "coalesce(r.status, 'not_started') <> 'completed'");
    }
    const rows = await this.sql.unsafe(`
      select c.*, cr.primary_hexagram_number, p.status as preview_status, r.status as reading_status
      from casting_sessions c
      left join cast_results cr on cr.casting_session_id = c.id
      left join previews p on p.casting_session_id = c.id
      left join readings r on r.casting_session_id = c.id
      where ${conditions.join(" and ")}
      order by c.created_at desc
      limit 200
    `, values);
    return rows.map((row) => ({
      id: String(row.id),
      method: String(row.method),
      scene: String(row.scene),
      lifecycle: String(row.lifecycle),
      riskStatus: String(row.risk_status),
      createdAt: new Date(String(row.created_at)),
      primaryName: row.primary_hexagram_number == null
        ? null
        : hexagramByNumber(Number(row.primary_hexagram_number)).englishName,
      hasPreview: row.preview_status === "completed",
      hasReading: row.reading_status === "completed",
    }));
  }

  async entitlementBalance(userId: string, now: Date): Promise<{ available: number; expiringSoon: number }> {
    const [row] = await this.sql`
      select
        coalesce(sum(quantity_available) filter (where expires_at > ${now}), 0)::int as available,
        coalesce(sum(quantity_available) filter (
          where expires_at > ${now} and expires_at < ${new Date(now.getTime() + 30 * DAY_MS)}
        ), 0)::int as expiring_soon
      from entitlement_batches where user_id = ${userId}
    `;
    return { available: Number(row.available), expiringSoon: Number(row.expiring_soon) };
  }

  async recoverableCasts(userId: string, now: Date): Promise<CastingSession[]> {
    const rows = await this.sql`
      select * from casting_sessions
      where user_id = ${userId} and lifecycle = 'user_deleted'
        and deleted_at is not null and purge_after > ${now}
      order by deleted_at desc
    `;
    return rows.map(mapSession);
  }

  async submitQualityReview(input: {
    readingId: string;
    userId: string;
    reason: string;
    now: Date;
  }): Promise<{ id: string; status: string; responseDueAt: Date }> {
    return this.sql.begin(async (tx) => {
      const [reading] = await tx`
        select r.*, c.user_id, c.lifecycle
        from readings r join casting_sessions c on c.id = r.casting_session_id
        where r.id = ${input.readingId} for update
      `;
      if (!reading) throw new DomainError("READING_NOT_FOUND", "Reading not found", false);
      if (reading.user_id !== input.userId || reading.lifecycle !== "revealed") {
        throw new DomainError("QUALITY_REVIEW_FORBIDDEN", "This review cannot be submitted.", false);
      }
      if (reading.status !== "completed") {
        throw new DomainError("QUALITY_REVIEW_NOT_DELIVERED", "Only delivered readings can be reviewed.", false);
      }
      const [existing] = await tx`select * from quality_reviews where reading_id = ${input.readingId}`;
      if (existing) {
        throw new DomainError("QUALITY_REVIEW_ALREADY_SUBMITTED", "A review has already been submitted.", false);
      }
      const reviewId = id("qr");
      const responseDueAt = new Date(input.now.getTime() + 7 * DAY_MS);
      await tx`
        insert into quality_reviews (
          id, reading_id, user_id, status, reason, response_due_at, created_at, updated_at
        ) values (
          ${reviewId}, ${input.readingId}, ${input.userId}, 'submitted', ${input.reason},
          ${responseDueAt}, ${input.now}, ${input.now}
        )
      `;
      return { id: reviewId, status: "submitted", responseDueAt };
    });
  }

  async requestDeletion(castingId: string, userId: string, now: Date): Promise<{ purgeAfter: Date }> {
    const purgeAfter = new Date(now.getTime() + 30 * DAY_MS);
    const rows = await this.sql`
      update casting_sessions set
        lifecycle = 'user_deleted', deleted_at = ${now}, purge_after = ${purgeAfter}, updated_at = ${now}
      where id = ${castingId} and user_id = ${userId} and lifecycle = 'revealed' and deleted_at is null
      returning id
    `;
    if (rows.length !== 1) throw new DomainError("CASTING_NOT_DELETABLE", "This casting cannot be deleted.", false);
    return { purgeAfter };
  }

  async restore(castingId: string, userId: string, now: Date): Promise<void> {
    const rows = await this.sql`
      update casting_sessions set
        lifecycle = 'revealed', deleted_at = null, purge_after = null, updated_at = ${now}
      where id = ${castingId} and user_id = ${userId} and lifecycle = 'user_deleted'
        and deleted_at is not null and purge_after > ${now}
      returning id
    `;
    if (rows.length !== 1) throw new DomainError("DELETION_RECOVERY_CLOSED", "This casting can no longer be restored.", false);
  }
}
