import { randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import {
  ALGORITHM_VERSIONS,
  type CastingMethod,
  type InterpretationGoal,
  type LineValue,
  type RiskStatus,
  type Scene,
} from "@/domain/casting/types";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { generateThreeCoinLine, cryptoRandomBit } from "@/domain/casting/three-coin/algorithm";
import { generateYarrowChange, cryptoRandomInt } from "@/domain/casting/yarrow/algorithm";
import { meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";
import { evaluateRisk } from "@/domain/risk/engine";
import { decryptJson, encryptJson, hmac } from "@/lib/crypto";
import { DomainError } from "@/server/errors/domain-error";
import type { RuntimeConfig } from "@/server/config";
import { resolveWriteKey } from "@/server/config";
import type { CastingSnapshot } from "@/server/services/casting-snapshot-service";
import { sealGenerationSnapshot } from "@/server/jobs/generation-snapshot";
import { PostgresGenerationJobRepository } from "@/server/repositories/postgres/generation-job-repository";
import type { PostgresAtomicRepository } from "@/server/repositories/postgres/atomic-repository";

const HOUR_MS = 60 * 60 * 1000;
const CASTING_WINDOW_MS = 24 * HOUR_MS;
const MAX_QUESTION_VERSIONS = 3;

type ProductionConfig = Extract<RuntimeConfig, { mode: "production" }>;
type JsonValue = Parameters<Sql["json"]>[0];
type Row = Record<string, unknown>;

function id(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function date(value: unknown): Date | null {
  return value == null ? null : new Date(String(value));
}

function assertOwned(row: Row, userId: string | null, anonymousSessionHash: string | null): void {
  const owned = userId != null
    ? row.user_id === userId
    : anonymousSessionHash != null && row.anonymous_session_hash === anonymousSessionHash;
  if (!owned || row.deleted_at) {
    throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
  }
}

function assertCastingOpen(row: Row, now: Date): void {
  if (row.lifecycle === "expired") {
    throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
  }
  const expiresAt = row.lifecycle === "casting" ? date(row.casting_expires_at) : date(row.reveal_expires_at);
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    throw new DomainError("CASTING_EXPIRED", "This casting cannot be changed in its current state.", false);
  }
}

function totalSteps(method: string): number {
  return method === "three_coin" ? 6 : method === "yarrow_stalk" ? 18 : 1;
}

export class PostgresCastingApplicationService {
  private readonly generationRepository: PostgresGenerationJobRepository;

  constructor(private readonly dependencies: {
    sql: Sql;
    atomicRepository: PostgresAtomicRepository;
    config: ProductionConfig;
  }) {
    this.generationRepository = new PostgresGenerationJobRepository(dependencies.sql);
  }

  async createDraft(input: {
    method: CastingMethod;
    scene: Scene;
    interpretationGoal: InterpretationGoal;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ castingId: string; method: CastingMethod; lifecycle: "draft" }> {
    const ownerKey = input.userId ?? input.anonymousSessionHash;
    if (!ownerKey) throw new DomainError("CASTING_OWNER_REQUIRED", "Casting owner is required.", false);
    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${ownerKey}, 0))`;
      const activeRows = input.userId
        ? await tx`
            select * from casting_sessions
            where user_id = ${input.userId}
              and lifecycle in ('draft', 'casting', 'awaiting_reveal')
            order by created_at desc limit 1 for update
          `
        : await tx`
            select * from casting_sessions
            where anonymous_session_hash = ${input.anonymousSessionHash}
              and lifecycle in ('draft', 'casting', 'awaiting_reveal')
            order by created_at desc limit 1 for update
          `;
      const active = activeRows[0];
      if (active) {
        const expired = active.lifecycle === "casting"
          ? date(active.casting_expires_at)?.getTime()! <= input.now.getTime()
          : active.lifecycle === "awaiting_reveal"
            ? date(active.reveal_expires_at)?.getTime()! <= input.now.getTime()
            : false;
        if (active.lifecycle === "draft") {
          await tx`update casting_sessions set lifecycle = 'cancelled', updated_at = ${input.now} where id = ${active.id}`;
        } else if (expired) {
          await tx`update casting_sessions set lifecycle = 'expired', updated_at = ${input.now} where id = ${active.id}`;
        } else {
          throw new DomainError("CASTING_ALREADY_IN_PROGRESS", "Finish or wait for the active casting to expire.", false);
        }
      }

      const castingId = id("cas");
      await tx`
        insert into casting_sessions (
          id, user_id, anonymous_session_hash, anonymous_hash_key_version,
          method, lifecycle, risk_status, scene, interpretation_goal,
          algorithm_version, created_at, updated_at
        ) values (
          ${castingId}, ${input.userId}, ${input.anonymousSessionHash},
          ${input.anonymousSessionHash ? this.dependencies.config.keys.sessionSigning.writeVersion : null},
          ${input.method}, 'draft', 'not_checked', ${input.scene}, ${input.interpretationGoal},
          ${ALGORITHM_VERSIONS[input.method]}, ${input.now}, ${input.now}
        )
      `;
      return { castingId, method: input.method, lifecycle: "draft" as const };
    });
  }

  async submitQuestion(input: {
    castingId: string;
    context: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ riskStatus: RiskStatus; reasonCode: string; emergency: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      const [casting] = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      if (!casting) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
      assertOwned(casting, input.userId, input.anonymousSessionHash);
      if (casting.current_question_version_id) {
        const existing = await this.loadQuestionContext(tx, input.castingId, String(casting.current_question_version_id));
        if (existing !== input.context) {
          throw new DomainError("QUESTION_IMMUTABLE", "The casting question can no longer be changed.", false);
        }
        const [risk] = await tx`select * from casting_risk_decisions where casting_session_id = ${input.castingId}`;
        if (!risk) throw new Error("CASTING_RISK_DECISION_MISSING");
        return {
          riskStatus: risk.status as RiskStatus,
          reasonCode: String(risk.reason_code),
          emergency: risk.status === "emergency_blocked",
        };
      }
      if (casting.lifecycle !== "draft") {
        throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
      }
      const risk = evaluateRisk(input.context, casting.scene as Scene);
      const questionId = id("qv");
      const encrypted = encryptJson({ context: input.context }, "context", undefined, `${input.castingId}:${questionId}`);
      await tx`
        insert into question_versions (
          id, casting_session_id, version_number, ciphertext, iv, auth_tag,
          encryption_key_version, created_reason, created_at
        ) values (
          ${questionId}, ${input.castingId}, 1, ${encrypted.data}, ${encrypted.iv}, ${encrypted.tag},
          ${encrypted.v}, 'initial', ${input.now}
        )
      `;
      await tx`
        insert into casting_risk_decisions (
          casting_session_id, rule_version, matched_rule_codes, reason_code, status, created_at
        ) values (
          ${input.castingId}, ${risk.ruleVersion}, ${tx.json(json(risk.matchedRuleCodes))},
          ${risk.reasonCode}, ${risk.status}, ${input.now}
        )
      `;
      await tx`
        update casting_sessions set
          current_question_version_id = ${questionId}, risk_status = ${risk.status},
          lifecycle = ${risk.status === "emergency_blocked" ? "emergency_blocked" : "draft"},
          updated_at = ${input.now}
        where id = ${input.castingId}
      `;
      return {
        riskStatus: risk.status,
        reasonCode: risk.reasonCode,
        emergency: risk.status === "emergency_blocked",
      };
    });
  }

  async clarifyQuestion(input: {
    castingId: string;
    context: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ riskStatus: RiskStatus; reasonCode: string; emergency: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      const [casting] = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      if (!casting) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
      assertOwned(casting, input.userId, input.anonymousSessionHash);
      if (casting.first_irreversible_step_at) {
        throw new DomainError("QUESTION_IMMUTABLE", "The casting question can no longer be changed.", false);
      }
      if (casting.risk_status !== "needs_clarification") {
        throw new DomainError("QUESTION_CLARIFICATION_NOT_REQUIRED", "This question is not awaiting clarification.", false);
      }
      const [countRow] = await tx`
        select count(*)::int as count from question_versions where casting_session_id = ${input.castingId}
      `;
      const versionNumber = Number(countRow.count) + 1;
      if (versionNumber > MAX_QUESTION_VERSIONS) {
        throw new DomainError("QUESTION_CLARIFICATION_LIMIT", "The clarification limit has been reached.", false);
      }
      const risk = evaluateRisk(input.context, casting.scene as Scene);
      const questionId = id("qv");
      const encrypted = encryptJson({ context: input.context }, "context", undefined, `${input.castingId}:${questionId}`);
      await tx`
        insert into question_versions (
          id, casting_session_id, version_number, ciphertext, iv, auth_tag,
          encryption_key_version, created_reason, created_at
        ) values (
          ${questionId}, ${input.castingId}, ${versionNumber}, ${encrypted.data}, ${encrypted.iv},
          ${encrypted.tag}, ${encrypted.v}, 'clarification', ${input.now}
        )
      `;
      await tx`
        update casting_risk_decisions set
          rule_version = ${risk.ruleVersion}, matched_rule_codes = ${tx.json(json(risk.matchedRuleCodes))},
          reason_code = ${risk.reasonCode}, status = ${risk.status}, created_at = ${input.now}
        where casting_session_id = ${input.castingId}
      `;
      await tx`
        update casting_sessions set
          current_question_version_id = ${questionId}, risk_status = ${risk.status},
          lifecycle = ${risk.status === "emergency_blocked" ? "emergency_blocked" : "draft"},
          updated_at = ${input.now}
        where id = ${input.castingId}
      `;
      return {
        riskStatus: risk.status,
        reasonCode: risk.reasonCode,
        emergency: risk.status === "emergency_blocked",
      };
    });
  }

  async recordCoinLine(input: {
    castingId: string;
    lineIndex: number;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ lineIndex: number; completed: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      const casting = await this.lockMutableCasting(tx, input, "three_coin");
      const [existing] = await tx`
        select * from casting_steps
        where casting_session_id = ${input.castingId} and step_kind = 'coin' and line_index = ${input.lineIndex}
      `;
      if (existing) {
        const [result] = await tx`select casting_session_id from cast_results where casting_session_id = ${input.castingId}`;
        return { lineIndex: input.lineIndex, completed: Boolean(result) };
      }
      const [progress] = await tx`
        select count(*)::int as count from casting_steps
        where casting_session_id = ${input.castingId} and step_kind = 'coin'
      `;
      if (Number(progress.count) !== input.lineIndex) {
        throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
      }
      const generated = generateThreeCoinLine(input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5, cryptoRandomBit);
      await this.insertStep(tx, casting, {
        stepKind: "coin",
        lineIndex: input.lineIndex,
        changeIndex: null,
        rawRecord: generated,
        lineValue: generated.lineValue,
        now: input.now,
      });
      const steps = await tx`
        select * from casting_steps
        where casting_session_id = ${input.castingId} and step_kind = 'coin'
        order by line_index
      `;
      if (steps.length === 6) {
        await this.persistResult(tx, casting, steps.map((step) => Number(step.line_value) as LineValue), {
          kind: "three-coin",
          steps: steps.map((step) => step.raw_record),
        }, input.now);
      }
      return { lineIndex: input.lineIndex, completed: steps.length === 6 };
    });
  }

  async recordYarrowChange(input: {
    castingId: string;
    lineIndex: number;
    changeIndex: number;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ lineIndex: number; changeIndex: number; completed: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      const casting = await this.lockMutableCasting(tx, input, "yarrow_stalk");
      const [existing] = await tx`
        select * from casting_steps
        where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
          and line_index = ${input.lineIndex} and change_index = ${input.changeIndex}
      `;
      if (existing) {
        const [countRow] = await tx`
          select count(*)::int as count from casting_steps
          where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
        `;
        return { lineIndex: input.lineIndex, changeIndex: input.changeIndex, completed: Number(countRow.count) === 18 };
      }
      const [progress] = await tx`
        select count(*)::int as count from casting_steps
        where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
      `;
      const expected = input.lineIndex * 3 + input.changeIndex;
      if (Number(progress.count) !== expected) {
        throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
      }
      let previousStalks = 49;
      if (input.changeIndex > 0) {
        const [previous] = await tx`
          select raw_record from casting_steps
          where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
            and line_index = ${input.lineIndex} and change_index = ${input.changeIndex - 1}
        `;
        previousStalks = Number((previous.raw_record as { endingStalks: number }).endingStalks);
      }
      const generated = generateYarrowChange(
        input.lineIndex as 0 | 1 | 2 | 3 | 4 | 5,
        input.changeIndex as 0 | 1 | 2,
        previousStalks,
        cryptoRandomInt,
      );
      await this.insertStep(tx, casting, {
        stepKind: "yarrow_change",
        lineIndex: input.lineIndex,
        changeIndex: input.changeIndex,
        rawRecord: generated,
        lineValue: input.changeIndex === 2 ? generated.endingStalks / 4 as LineValue : null,
        now: input.now,
      });
      return { lineIndex: input.lineIndex, changeIndex: input.changeIndex, completed: expected + 1 === 18 };
    });
  }

  async completeYarrow(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ completed: true }> {
    return this.dependencies.sql.begin(async (tx) => {
      const casting = await this.lockMutableCasting(tx, input, "yarrow_stalk");
      const [existing] = await tx`select casting_session_id from cast_results where casting_session_id = ${input.castingId}`;
      if (existing) return { completed: true };
      const steps = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId}
          and step_kind = 'yarrow_change' order by line_index, change_index
      `;
      if (steps.length !== 18) throw new DomainError("CASTING_INCOMPLETE", "All 18 changes are required", false);
      const lineValues = [0, 1, 2, 3, 4, 5].map((lineIndex) =>
        Number(steps.find((step) => Number(step.line_index) === lineIndex && Number(step.change_index) === 2)!.line_value) as LineValue,
      );
      await this.persistResult(tx, casting, lineValues, {
        kind: "yarrow",
        steps: steps.map((step) => step.raw_record),
      }, input.now);
      return { completed: true };
    });
  }

  async recordMeiHua(input: {
    castingId: string;
    ianaTimeZone: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<{ completed: true }> {
    try { new Intl.DateTimeFormat("en-US", { timeZone: input.ianaTimeZone }).format(); }
    catch { throw new DomainError("INVALID_TIME_ZONE", "Invalid request input", false, "ianaTimeZone"); }
    return this.dependencies.sql.begin(async (tx) => {
      const casting = await this.lockMutableCasting(tx, input, "mei_hua_current_time");
      const [existingResult] = await tx`select casting_session_id from cast_results where casting_session_id = ${input.castingId}`;
      if (existingResult) return { completed: true };
      const result = meiHuaFromUtc(input.now.getTime(), input.ianaTimeZone);
      await this.insertStep(tx, casting, {
        stepKind: "mei_hua",
        lineIndex: 0,
        changeIndex: null,
        rawRecord: { result },
        lineValue: result.lineValuesBottomUp[0],
        now: input.now,
      });
      await this.persistResult(tx, casting, [...result.lineValuesBottomUp], result.methodCalculation, input.now);
      return { completed: true };
    });
  }

  async snapshot(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<CastingSnapshot | null> {
    const [casting] = await this.dependencies.sql`select * from casting_sessions where id = ${input.castingId}`;
    if (!casting) return null;
    try { assertOwned(casting, input.userId, input.anonymousSessionHash); }
    catch { return null; }
    const steps = await this.dependencies.sql`
      select step_kind from casting_steps where casting_session_id = ${input.castingId}
    `;
    const total = totalSteps(String(casting.method));
    const completed = casting.method === "three_coin"
      ? steps.filter((step) => step.step_kind === "coin").length
      : casting.method === "yarrow_stalk"
        ? steps.filter((step) => step.step_kind === "yarrow_change").length
        : Math.min(1, steps.filter((step) => step.step_kind === "mei_hua").length);
    const castingExpired = date(casting.casting_expires_at)?.getTime()! <= input.now.getTime();
    const revealExpired = date(casting.reveal_expires_at)?.getTime()! <= input.now.getTime();
    const canReadResult = casting.lifecycle === "revealed" && input.userId != null && casting.user_id === input.userId;
    const [result] = canReadResult
      ? await this.dependencies.sql`select * from cast_results where casting_session_id = ${input.castingId}`
      : [];
    const [preview] = canReadResult
      ? await this.dependencies.sql`select * from previews where casting_session_id = ${input.castingId}`
      : [];
    const [reading] = canReadResult
      ? await this.dependencies.sql`select * from readings where casting_session_id = ${input.castingId}`
      : [];
    const phase: CastingSnapshot["phase"] = casting.risk_status === "emergency_blocked" || casting.lifecycle === "emergency_blocked"
      ? "crisis"
      : castingExpired || revealExpired || casting.lifecycle === "expired"
        ? "expired"
        : casting.lifecycle === "revealed"
          ? "result"
          : casting.lifecycle === "awaiting_reveal" || completed >= total
            ? "reveal"
            : "ritual";
    return {
      castingId: String(casting.id),
      method: casting.method as CastingMethod,
      scene: String(casting.scene),
      interpretationGoal: String(casting.interpretation_goal),
      lifecycle: String(casting.lifecycle),
      riskStatus: casting.risk_status as RiskStatus,
      phase,
      progress: { completedSteps: completed, totalSteps: total },
      canReadResult,
      result: result ? {
        primaryName: hexagramByNumber(Number(result.primary_hexagram_number)).englishName,
        primaryNumber: Number(result.primary_hexagram_number),
        movingLinePositions: result.moving_line_positions as number[],
        relatingName: result.relating_hexagram_number == null
          ? null
          : hexagramByNumber(Number(result.relating_hexagram_number)).englishName,
        relatingNumber: result.relating_hexagram_number == null ? null : Number(result.relating_hexagram_number),
        lineValues: result.line_values as number[],
        algorithmVersion: String(result.algorithm_version),
        classicMappingVersion: String(result.classic_mapping_version),
      } : null,
      preview: preview ? {
        status: String(preview.status),
        relevanceStatement: preview.relevance_statement == null ? null : String(preview.relevance_statement),
      } : null,
      reading: reading ? {
        id: String(reading.id),
        status: String(reading.status),
        report: reading.report as Record<string, unknown> | null,
      } : null,
    };
  }

  async enqueuePreview(input: {
    castingId: string;
    userId: string;
    now: Date;
  }): Promise<{ status: string; relevanceStatement: string | null }> {
    const snapshot = await this.loadGenerationInput(input.castingId, input.userId);
    const [existing] = await this.dependencies.sql`select * from previews where casting_session_id = ${input.castingId}`;
    if (existing?.status === "completed") {
      return { status: "completed", relevanceStatement: String(existing.relevance_statement) };
    }
    const previewId = existing?.id ?? id("prv");
    await this.dependencies.sql`
      insert into previews (id, casting_session_id, status, schema_version, created_at, updated_at)
      values (${previewId}, ${input.castingId}, 'queued', 'preview-v2.1', ${input.now}, ${input.now})
      on conflict (casting_session_id) do update set status = 'queued', updated_at = excluded.updated_at
    `;
    await this.generationRepository.enqueue({
      jobType: "preview",
      castingId: input.castingId,
      readingId: null,
      reservationId: null,
      snapshot: sealGenerationSnapshot(input.castingId, snapshot),
      timeoutAt: new Date(input.now.getTime() + 2 * 60 * 1000),
      outboxTopic: "generation.requested",
    });
    return { status: "queued", relevanceStatement: null };
  }

  async enqueueReading(input: {
    castingId: string;
    userId: string;
    now: Date;
  }): Promise<{ status: string; readingId: string; report: unknown | null }> {
    const generationInput = await this.loadGenerationInput(input.castingId, input.userId);
    const existingRows = await this.dependencies.sql`select * from readings where casting_session_id = ${input.castingId}`;
    const existing = existingRows[0];
    if (existing?.status === "completed" && existing.report) {
      return { status: "completed", readingId: String(existing.id), report: existing.report };
    }
    const readingId = existing?.id ?? id("rdg");
    if (!existing) {
      await this.dependencies.sql`
        insert into readings (id, casting_session_id, status, schema_version, created_at, updated_at)
        values (${readingId}, ${input.castingId}, 'not_started', 'reading-v2.1', ${input.now}, ${input.now})
      `;
    }
    const reservation = await this.dependencies.atomicRepository.freezeForReading(readingId, input.userId, input.now);
    if ("error" in reservation) {
      throw new DomainError("ENTITLEMENT_NOT_AVAILABLE", "You have no available reading credit", false);
    }
    await this.dependencies.sql`
      update readings set status = 'queued', reservation_id = ${reservation.reservationId}, updated_at = ${input.now}
      where id = ${readingId}
    `;
    await this.generationRepository.enqueue({
      jobType: "deep_reading",
      castingId: input.castingId,
      readingId,
      reservationId: reservation.reservationId,
      snapshot: sealGenerationSnapshot(input.castingId, generationInput),
      timeoutAt: new Date(input.now.getTime() + 5 * 60 * 1000),
      outboxTopic: "generation.requested",
    });
    return { status: "queued", readingId, report: null };
  }

  private async loadGenerationInput(castingId: string, userId: string) {
    const rows = await this.dependencies.sql`
      select
        c.*, r.line_values, r.primary_hexagram_number, r.moving_line_positions,
        r.relating_hexagram_number, r.algorithm_version as result_algorithm_version,
        r.classic_mapping_version, q.id as question_id, q.ciphertext, q.iv,
        q.auth_tag, q.encryption_key_version
      from casting_sessions c
      join cast_results r on r.casting_session_id = c.id
      join question_versions q on q.id = c.current_question_version_id
      where c.id = ${castingId}
    `;
    const row = rows[0];
    if (!row || row.user_id !== userId || row.lifecycle !== "revealed" || row.deleted_at) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    }
    const context = decryptJson<{ context: string }>({
      v: String(row.encryption_key_version),
      iv: String(row.iv),
      tag: String(row.auth_tag),
      data: String(row.ciphertext),
    }, "context", `${castingId}:${row.question_id}`).context;
    const risk = evaluateRisk(context, row.scene as Scene);
    if (risk.status !== "allowed") {
      throw new DomainError("RISK_BLOCKED", "A personalized reading is not available for this question", false);
    }
    return {
      result: {
        lineValuesBottomUp: row.line_values as [LineValue, LineValue, LineValue, LineValue, LineValue, LineValue],
        primaryHexagramNumber: Number(row.primary_hexagram_number),
        movingLinePositions: row.moving_line_positions as number[],
        relatingHexagramNumber: row.relating_hexagram_number == null ? null : Number(row.relating_hexagram_number),
        method: row.method as CastingMethod,
        algorithmVersion: String(row.result_algorithm_version),
        classicMappingVersion: String(row.classic_mapping_version),
      },
      scene: row.scene as Scene,
      interpretationGoal: row.interpretation_goal as InterpretationGoal,
      context,
    };
  }

  private async lockMutableCasting(
    tx: Sql,
    input: { castingId: string; userId: string | null; anonymousSessionHash: string | null; now: Date },
    method: CastingMethod,
  ): Promise<Row> {
    const [casting] = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
    if (!casting) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    assertOwned(casting, input.userId, input.anonymousSessionHash);
    if (casting.method !== method) {
      throw new DomainError("CASTING_METHOD_MISMATCH", "This casting cannot be changed in its current state.", false);
    }
    assertCastingOpen(casting, input.now);
    if (!casting.current_question_version_id) {
      throw new DomainError("QUESTION_REQUIRED", "Submit the question before casting.", false);
    }
    if (["needs_clarification", "emergency_blocked"].includes(String(casting.risk_status))) {
      throw new DomainError("RISK_BLOCKED", "This question cannot continue to casting yet.", false);
    }
    if (!["draft", "casting", "awaiting_reveal"].includes(String(casting.lifecycle))) {
      throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
    }
    if (casting.lifecycle === "awaiting_reveal") {
      throw new DomainError("CASTING_ALREADY_COMPLETE", "This casting is already complete.", false);
    }
    return casting;
  }

  private async insertStep(
    tx: Sql,
    casting: Row,
    input: {
      stepKind: string;
      lineIndex: number;
      changeIndex: number | null;
      rawRecord: unknown;
      lineValue: LineValue | null;
      now: Date;
    },
  ): Promise<void> {
    await tx`
      insert into casting_steps (
        id, casting_session_id, step_kind, line_index, change_index,
        raw_record, line_value, algorithm_version, created_at
      ) values (
        ${id("step")}, ${casting.id}, ${input.stepKind}, ${input.lineIndex}, ${input.changeIndex},
        ${tx.json(json(input.rawRecord))}, ${input.lineValue}, ${casting.algorithm_version}, ${input.now}
      )
    `;
    if (!casting.first_irreversible_step_at) {
      await tx`
        update casting_sessions set
          lifecycle = 'casting', first_irreversible_step_at = ${input.now},
          casting_expires_at = ${new Date(input.now.getTime() + CASTING_WINDOW_MS)}, updated_at = ${input.now}
        where id = ${casting.id}
      `;
      casting.first_irreversible_step_at = input.now;
      casting.lifecycle = "casting";
    } else {
      await tx`update casting_sessions set updated_at = ${input.now} where id = ${casting.id}`;
    }
  }

  private async persistResult(
    tx: Sql,
    casting: Row,
    lineValues: LineValue[],
    methodCalculation: unknown,
    now: Date,
  ): Promise<void> {
    const result = buildHexagramResult({
      lineValuesBottomUp: lineValues,
      method: casting.method as CastingMethod,
      algorithmVersion: String(casting.algorithm_version),
    });
    const hmacInput = JSON.stringify({
      l: result.lineValuesBottomUp,
      p: result.primaryHexagramNumber,
      m: result.movingLinePositions,
      r: result.relatingHexagramNumber,
      a: result.algorithmVersion,
      c: result.classicMappingVersion,
    });
    const key = resolveWriteKey(this.dependencies.config.keys.resultIntegrity);
    await tx`
      insert into cast_results (
        casting_session_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, result_hmac, result_hmac_key_version,
        algorithm_version, classic_mapping_version, created_at
      ) values (
        ${casting.id}, ${tx.json(json(lineValues))}, ${result.primaryHexagramNumber},
        ${tx.json(json(result.movingLinePositions))}, ${result.relatingHexagramNumber},
        ${tx.json(json(methodCalculation))}, ${hmac(hmacInput, "result", key.version)}, ${key.version},
        ${result.algorithmVersion}, ${result.classicMappingVersion}, ${now}
      )
      on conflict (casting_session_id) do nothing
    `;
    await tx`
      update casting_sessions set
        lifecycle = 'awaiting_reveal', completed_at = ${now},
        reveal_expires_at = ${new Date(now.getTime() + CASTING_WINDOW_MS)}, updated_at = ${now}
      where id = ${casting.id} and lifecycle in ('draft', 'casting')
    `;
  }

  private async loadQuestionContext(tx: Sql, castingId: string, questionId: string): Promise<string> {
    const [question] = await tx`select * from question_versions where id = ${questionId} and casting_session_id = ${castingId}`;
    if (!question) throw new Error("QUESTION_VERSION_NOT_FOUND");
    return decryptJson<{ context: string }>({
      v: String(question.encryption_key_version),
      iv: String(question.iv),
      tag: String(question.auth_tag),
      data: String(question.ciphertext),
    }, "context", `${castingId}:${questionId}`).context;
  }
}
