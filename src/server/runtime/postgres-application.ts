import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";
import { meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { generateYarrowChange } from "@/domain/casting/yarrow/algorithm";
import {
  ALGORITHM_VERSIONS,
  type CastingMethod,
  type InterpretationGoal,
  type LineValue,
  type RiskStatus,
  type Scene,
} from "@/domain/casting/types";
import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import { evaluateRisk } from "@/domain/risk/engine";
import { assertAllowedCallbackPath, hashLoginIntentNonce, nonceMatches } from "@/server/auth/login-intent";
import { resolveVersionedKey, resolveWriteKey, runtimeConfig } from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import { decryptJson, encryptJson, hmac, randomToken } from "@/lib/crypto";
import { PostgresAtomicRepository } from "@/server/repositories/postgres/atomic-repository";
import type { CastingSnapshot, CastingSnapshotPhase } from "@/server/services/casting-snapshot-service";

const HOUR_MS = 60 * 60 * 1000;
const LOGIN_INTENT_TTL_MS = 10 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function date(value: unknown): Date | null {
  return value == null ? null : value instanceof Date ? value : new Date(String(value));
}

function rowLineValues(value: unknown): LineValue[] {
  if (!Array.isArray(value) || value.length !== 6) throw new Error("CAST_RESULT_INVALID");
  const lines = value.map(Number);
  if (!lines.every((line) => [6, 7, 8, 9].includes(line))) throw new Error("CAST_RESULT_INVALID");
  return lines as LineValue[];
}

function totalSteps(method: CastingMethod): number {
  return method === "three_coin" ? 6 : method === "yarrow_stalk" ? 18 : 1;
}

function phase(input: {
  lifecycle: string;
  riskStatus: RiskStatus;
  completedSteps: number;
  totalSteps: number;
  castingExpiresAt: Date | null;
  revealExpiresAt: Date | null;
  now: Date;
}): CastingSnapshotPhase {
  if (input.riskStatus === "emergency_blocked" || input.lifecycle === "emergency_blocked") return "crisis";
  if (
    input.lifecycle === "expired"
    || (input.lifecycle === "casting" && input.castingExpiresAt != null && input.castingExpiresAt.getTime() <= input.now.getTime())
    || (input.lifecycle === "awaiting_reveal" && input.revealExpiresAt != null && input.revealExpiresAt.getTime() <= input.now.getTime())
  ) return "expired";
  if (input.lifecycle === "revealed") return "result";
  if (input.lifecycle === "awaiting_reveal" || input.completedSteps >= input.totalSteps) return "reveal";
  return "ritual";
}

export class PostgresApplicationRuntime {
  private readonly atomicRepository: PostgresAtomicRepository;

  constructor(private readonly dependencies: {
    sql: Sql;
    clock: { now(): Date };
    random: { randomBit(): boolean; randomInt(maxExclusive: number): number };
  }) {
    this.atomicRepository = new PostgresAtomicRepository(dependencies.sql);
  }

  async createDraft(input: {
    method: CastingMethod;
    scene: Scene;
    interpretationGoal: InterpretationGoal;
    userId: string | null;
    anonymousSessionHash: string | null;
  }): Promise<{ castingId: string; method: CastingMethod; lifecycle: "draft" }> {
    const ownerId = input.userId ?? input.anonymousSessionHash;
    if (!ownerId) throw new DomainError("CASTING_OWNER_REQUIRED", "Casting owner is required.", false);
    const now = this.dependencies.clock.now();
    const castingId = id("cas");

    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`casting-owner:${input.userId ? "user" : "anon"}:${ownerId}`}, 0))`;
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
        const castingExpired = active.lifecycle === "casting"
          && active.casting_expires_at
          && date(active.casting_expires_at)!.getTime() <= now.getTime();
        const revealExpired = active.lifecycle === "awaiting_reveal"
          && active.reveal_expires_at
          && date(active.reveal_expires_at)!.getTime() <= now.getTime();
        if (active.lifecycle === "draft") {
          await tx`update casting_sessions set lifecycle = 'cancelled', updated_at = ${now} where id = ${active.id}`;
        } else if (castingExpired || revealExpired) {
          await tx`update casting_sessions set lifecycle = 'expired', updated_at = ${now} where id = ${active.id}`;
        } else {
          throw new DomainError("CASTING_ALREADY_IN_PROGRESS", "A casting is already in progress.", false);
        }
      }

      await tx`
        insert into casting_sessions (
          id, user_id, anonymous_session_hash, anonymous_hash_key_version,
          method, lifecycle, risk_status, scene, interpretation_goal, algorithm_version,
          created_at, updated_at
        ) values (
          ${castingId}, ${input.userId}, ${input.anonymousSessionHash},
          ${input.anonymousSessionHash ? runtimeConfig().keys.sessionSigning.writeVersion : null},
          ${input.method}, 'draft', 'not_checked', ${input.scene}, ${input.interpretationGoal},
          ${ALGORITHM_VERSIONS[input.method]}, ${now}, ${now}
        )
      `;
      return { castingId, method: input.method, lifecycle: "draft" as const };
    });
  }

  async submitQuestion(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    context: string;
  }): Promise<{ riskStatus: RiskStatus; reasonCode: string; emergency: boolean }> {
    return this.writeQuestion({ ...input, reason: "initial", expectedVersion: 1 });
  }

  async clarifyQuestion(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    context: string;
  }): Promise<{ riskStatus: RiskStatus; reasonCode: string; emergency: boolean }> {
    const countRows = await this.dependencies.sql`
      select count(*)::integer as count from question_versions where casting_session_id = ${input.castingId}
    `;
    const count = Number(countRows[0]?.count ?? 0);
    if (count >= 3) throw new DomainError("RISK_CLARIFICATION_LIMIT", "The clarification limit has been reached.", false);
    return this.writeQuestion({ ...input, reason: "clarification", expectedVersion: count + 1 });
  }

  private async writeQuestion(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    context: string;
    reason: string;
    expectedVersion: number;
  }): Promise<{ riskStatus: RiskStatus; reasonCode: string; emergency: boolean }> {
    const now = this.dependencies.clock.now();
    return this.dependencies.sql.begin(async (tx) => {
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      this.assertOwned(casting, input.userId, input.anonymousSessionHash);
      if (casting.lifecycle !== "draft") {
        throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
      }
      if (casting.current_question_version_id && input.reason === "initial") {
        const existing = await this.readQuestion(tx, casting);
        if (existing !== input.context) throw new DomainError("QUESTION_IMMUTABLE", "The casting question can no longer be changed.", false);
        const riskRows = await tx`select * from casting_risk_decisions where casting_session_id = ${input.castingId}`;
        const risk = riskRows[0];
        return {
          riskStatus: risk.status,
          reasonCode: risk.reason_code,
          emergency: risk.status === "emergency_blocked",
        };
      }
      if (input.reason === "clarification") {
        const stepRows = await tx`select id from casting_steps where casting_session_id = ${input.castingId} limit 1`;
        if (stepRows.length > 0 || !["needs_clarification", "professional_decision_blocked"].includes(casting.risk_status)) {
          throw new DomainError("RISK_CLARIFICATION_CLOSED", "This question can no longer be clarified.", false);
        }
      }

      const questionId = id("qv");
      const encrypted = encryptJson(
        { context: input.context },
        "context",
        undefined,
        `${input.castingId}:${questionId}`,
      );
      const decision = evaluateRisk(input.context, casting.scene as Scene);
      await tx`
        insert into question_versions (
          id, casting_session_id, version_number, ciphertext, iv, auth_tag,
          encryption_key_version, created_reason, created_at
        ) values (
          ${questionId}, ${input.castingId}, ${input.expectedVersion}, ${encrypted.data}, ${encrypted.iv},
          ${encrypted.tag}, ${encrypted.v}, ${input.reason}, ${now}
        )
      `;
      await tx`
        insert into casting_risk_decisions (
          casting_session_id, rule_version, matched_rule_codes, reason_code, status, created_at
        ) values (
          ${input.castingId}, ${decision.ruleVersion}, ${tx.json(decision.matchedRuleCodes as never)},
          ${decision.reasonCode}, ${decision.status}, ${now}
        )
        on conflict (casting_session_id) do update set
          rule_version = excluded.rule_version,
          matched_rule_codes = excluded.matched_rule_codes,
          reason_code = excluded.reason_code,
          status = excluded.status,
          created_at = excluded.created_at
      `;
      await tx`
        update casting_sessions set
          current_question_version_id = ${questionId}, risk_status = ${decision.status},
          lifecycle = ${decision.status === "emergency_blocked" ? "emergency_blocked" : "draft"},
          updated_at = ${now}
        where id = ${input.castingId}
      `;
      return {
        riskStatus: decision.status,
        reasonCode: decision.reasonCode,
        emergency: decision.status === "emergency_blocked",
      };
    });
  }

  async recordCoinLine(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  }): Promise<{ lineIndex: number; completed: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`casting:${input.castingId}`}, 0))`;
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      this.assertOwned(casting, input.userId, input.anonymousSessionHash);
      this.assertMutable(casting, "three_coin");
      const existingRows = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId}
          and step_kind = 'coin' and line_index = ${input.lineIndex}
      `;
      if (existingRows[0]) {
        const countRows = await tx`select count(*)::integer as count from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'coin'`;
        return { lineIndex: input.lineIndex, completed: Number(countRows[0].count) === 6 };
      }
      const countRows = await tx`select count(*)::integer as count from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'coin'`;
      if (Number(countRows[0].count) !== input.lineIndex) {
        throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
      }
      const generated = generateThreeCoinLine(input.lineIndex, this.dependencies.random.randomBit);
      const now = this.dependencies.clock.now();
      await tx`
        insert into casting_steps (
          id, casting_session_id, step_kind, line_index, change_index,
          raw_record, line_value, algorithm_version, created_at
        ) values (
          ${id("step")}, ${input.castingId}, 'coin', ${input.lineIndex}, null,
          ${tx.json(generated as never)}, ${generated.lineValue}, ${casting.algorithm_version}, ${now}
        )
      `;
      await this.markIrreversible(tx, casting, now);
      const steps = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'coin'
        order by line_index asc
      `;
      if (steps.length === 6) {
        await this.persistResult(tx, casting, steps.map((step) => Number(step.line_value) as LineValue), {
          kind: "three-coin",
          steps: steps.map((step) => step.raw_record),
        }, now);
      }
      return { lineIndex: input.lineIndex, completed: steps.length === 6 };
    });
  }

  async recordYarrowChange(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
    changeIndex: 0 | 1 | 2;
  }): Promise<{ lineIndex: number; changeIndex: number; completed: boolean }> {
    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`casting:${input.castingId}`}, 0))`;
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      this.assertOwned(casting, input.userId, input.anonymousSessionHash);
      this.assertMutable(casting, "yarrow_stalk");
      const existing = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId}
          and step_kind = 'yarrow_change' and line_index = ${input.lineIndex} and change_index = ${input.changeIndex}
      `;
      if (existing[0]) {
        const countRows = await tx`select count(*)::integer as count from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'`;
        return { lineIndex: input.lineIndex, changeIndex: input.changeIndex, completed: Number(countRows[0].count) === 18 };
      }
      const steps = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
        order by line_index asc, change_index asc
      `;
      const expectedIndex = input.lineIndex * 3 + input.changeIndex;
      if (steps.length !== expectedIndex) {
        throw new DomainError("CASTING_STEP_OUT_OF_ORDER", "This casting cannot be changed in its current state.", false);
      }
      const previousStalks = input.changeIndex === 0
        ? 49
        : Number((steps[steps.length - 1].raw_record as { endingStalks: number }).endingStalks);
      const generated = generateYarrowChange(
        input.lineIndex,
        input.changeIndex,
        previousStalks,
        this.dependencies.random.randomInt,
      );
      const lineValue = input.changeIndex === 2 ? generated.endingStalks / 4 as LineValue : null;
      const now = this.dependencies.clock.now();
      await tx`
        insert into casting_steps (
          id, casting_session_id, step_kind, line_index, change_index,
          raw_record, line_value, algorithm_version, created_at
        ) values (
          ${id("step")}, ${input.castingId}, 'yarrow_change', ${input.lineIndex}, ${input.changeIndex},
          ${tx.json(generated as never)}, ${lineValue}, ${casting.algorithm_version}, ${now}
        )
      `;
      await this.markIrreversible(tx, casting, now);
      return { lineIndex: input.lineIndex, changeIndex: input.changeIndex, completed: steps.length + 1 === 18 };
    });
  }

  async completeYarrow(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
  }): Promise<{ completed: true }> {
    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`casting:${input.castingId}`}, 0))`;
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      this.assertOwned(casting, input.userId, input.anonymousSessionHash);
      if (casting.method !== "yarrow_stalk") throw new DomainError("CASTING_METHOD_MISMATCH", "Casting method mismatch.", false);
      const resultRows = await tx`select casting_session_id from cast_results where casting_session_id = ${input.castingId}`;
      if (resultRows[0]) return { completed: true };
      this.assertMutable(casting, "yarrow_stalk");
      const steps = await tx`
        select * from casting_steps where casting_session_id = ${input.castingId} and step_kind = 'yarrow_change'
        order by line_index asc, change_index asc
      `;
      if (steps.length !== 18) throw new DomainError("CASTING_INCOMPLETE", "All 18 changes are required.", false);
      const lineValues = [0, 1, 2, 3, 4, 5].map((lineIndex) => Number(
        steps.find((step) => Number(step.line_index) === lineIndex && Number(step.change_index) === 2)!.line_value,
      ) as LineValue);
      await this.persistResult(tx, casting, lineValues, {
        kind: "yarrow",
        steps: steps.map((step) => step.raw_record),
      }, this.dependencies.clock.now());
      return { completed: true };
    });
  }

  async recordMeiHua(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    ianaTimeZone: string;
  }): Promise<{ completed: true }> {
    return this.dependencies.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`casting:${input.castingId}`}, 0))`;
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      this.assertOwned(casting, input.userId, input.anonymousSessionHash);
      if (casting.method !== "mei_hua_current_time") throw new DomainError("CASTING_METHOD_MISMATCH", "Casting method mismatch.", false);
      const existingResult = await tx`select casting_session_id from cast_results where casting_session_id = ${input.castingId}`;
      if (existingResult[0]) return { completed: true };
      this.assertMutable(casting, "mei_hua_current_time");
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.ianaTimeZone }).format();
      } catch {
        throw new DomainError("INVALID_TIME_ZONE", "Invalid time zone.", false, "ianaTimeZone");
      }
      const now = this.dependencies.clock.now();
      const result = meiHuaFromUtc(now.getTime(), input.ianaTimeZone);
      await tx`
        insert into casting_steps (
          id, casting_session_id, step_kind, line_index, change_index,
          raw_record, line_value, algorithm_version, created_at
        ) values (
          ${id("step")}, ${input.castingId}, 'mei_hua', 0, null,
          ${tx.json({ result } as never)}, ${result.lineValuesBottomUp[0]}, ${casting.algorithm_version}, ${now}
        )
      `;
      await this.markIrreversible(tx, casting, now);
      await this.persistResult(tx, casting, [...result.lineValuesBottomUp], result.methodCalculation, now);
      return { completed: true };
    });
  }

  async loadCastingSnapshot(input: {
    castingId: string;
    userId: string | null;
    anonymousSessionHash: string | null;
    now: Date;
  }): Promise<CastingSnapshot | null> {
    const rows = await this.dependencies.sql`
      select * from casting_sessions where id = ${input.castingId} and deleted_at is null
    `;
    const casting = rows[0];
    if (!casting || !this.isOwned(casting, input.userId, input.anonymousSessionHash)) return null;
    const stepRows = await this.dependencies.sql`
      select step_kind from casting_steps where casting_session_id = ${input.castingId}
    `;
    const method = casting.method as CastingMethod;
    const completedSteps = method === "three_coin"
      ? stepRows.filter((step) => step.step_kind === "coin").length
      : method === "yarrow_stalk"
        ? stepRows.filter((step) => step.step_kind === "yarrow_change").length
        : Math.min(stepRows.filter((step) => step.step_kind === "mei_hua").length, 1);
    const total = totalSteps(method);
    const canReadResult = casting.lifecycle === "revealed"
      && input.userId != null
      && casting.user_id === input.userId;
    const resultRows = canReadResult
      ? await this.dependencies.sql`select * from cast_results where casting_session_id = ${input.castingId}`
      : [];
    const previewRows = canReadResult
      ? await this.dependencies.sql`select status, relevance_statement from previews where casting_session_id = ${input.castingId}`
      : [];
    const readingRows = canReadResult
      ? await this.dependencies.sql`select id, status, report from readings where casting_session_id = ${input.castingId}`
      : [];
    const result = resultRows[0];

    return {
      castingId: casting.id,
      method,
      scene: casting.scene,
      interpretationGoal: casting.interpretation_goal,
      lifecycle: casting.lifecycle,
      riskStatus: casting.risk_status,
      phase: phase({
        lifecycle: casting.lifecycle,
        riskStatus: casting.risk_status,
        completedSteps,
        totalSteps: total,
        castingExpiresAt: date(casting.casting_expires_at),
        revealExpiresAt: date(casting.reveal_expires_at),
        now: input.now,
      }),
      progress: { completedSteps, totalSteps: total },
      canReadResult,
      result: result ? {
        primaryName: hexagramByNumber(Number(result.primary_hexagram_number)).englishName,
        primaryNumber: Number(result.primary_hexagram_number),
        movingLinePositions: (result.moving_line_positions as number[]).map(Number),
        relatingName: result.relating_hexagram_number == null
          ? null
          : hexagramByNumber(Number(result.relating_hexagram_number)).englishName,
        relatingNumber: result.relating_hexagram_number == null ? null : Number(result.relating_hexagram_number),
        lineValues: rowLineValues(result.line_values),
        algorithmVersion: result.algorithm_version,
        classicMappingVersion: result.classic_mapping_version,
      } : null,
      preview: previewRows[0] ? {
        status: previewRows[0].status,
        relevanceStatement: previewRows[0].relevance_statement ?? null,
      } : null,
      reading: readingRows[0] ? {
        id: readingRows[0].id,
        status: readingRows[0].status,
        report: readingRows[0].report ?? null,
      } : null,
    };
  }

  async startLoginIntent(input: {
    castingId: string;
    anonymousSessionHash: string;
    allowedCallbackPath: string;
  }): Promise<{ intentId: string; nonce: string; allowedCallbackPath: string; expiresAt: Date }> {
    const callbackPath = assertAllowedCallbackPath(input.allowedCallbackPath);
    const now = this.dependencies.clock.now();
    const config = runtimeConfig();
    const nonceKey = resolveWriteKey(config.keys.sessionSigning);
    const nonce = randomToken(32);
    const intentId = id("lint");

    return this.dependencies.sql.begin(async (tx) => {
      const rows = await tx`select * from casting_sessions where id = ${input.castingId} for update`;
      const casting = rows[0];
      if (
        !casting
        || casting.user_id != null
        || casting.anonymous_session_hash !== input.anonymousSessionHash
        || casting.lifecycle !== "awaiting_reveal"
      ) throw new DomainError("CASTING_NOT_REVEALABLE", "This casting is not ready to reveal.", false);
      const revealExpiresAt = date(casting.reveal_expires_at);
      if (revealExpiresAt && revealExpiresAt.getTime() <= now.getTime()) {
        await tx`update casting_sessions set lifecycle = 'expired', updated_at = ${now} where id = ${input.castingId}`;
        throw new DomainError("CASTING_EXPIRED", "This casting is no longer available to reveal.", false);
      }
      const expiresAt = new Date(Math.min(
        now.getTime() + LOGIN_INTENT_TTL_MS,
        revealExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
      ));
      await tx`
        insert into login_intents (
          id, casting_session_id, anonymous_session_hash, nonce_hash, nonce_key_version,
          allowed_callback_path, expires_at, created_at
        ) values (
          ${intentId}, ${input.castingId}, ${input.anonymousSessionHash},
          ${hashLoginIntentNonce(nonce, nonceKey)}, ${nonceKey.version}, ${callbackPath}, ${expiresAt}, ${now}
        )
      `;
      return { intentId, nonce, allowedCallbackPath: callbackPath, expiresAt };
    });
  }

  async consumeLoginIntentAndReveal(input: {
    intentId: string;
    nonce: string;
    authenticatedUserId: string;
    callbackPath: string;
  }) {
    const callbackPath = assertAllowedCallbackPath(input.callbackPath);
    const intentRows = await this.dependencies.sql`select * from login_intents where id = ${input.intentId}`;
    const intent = intentRows[0];
    if (!intent) throw new DomainError("LOGIN_INTENT_NOT_FOUND", "This sign-in link is invalid.", false);
    const config = runtimeConfig();
    if (!nonceMatches(intent.nonce_hash, intent.nonce_key_version, input.nonce, config.keys.sessionSigning)) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }
    const castingRows = await this.dependencies.sql`
      select c.*, q.id as question_id, q.ciphertext, q.iv, q.auth_tag, q.encryption_key_version
      from casting_sessions c
      join question_versions q on q.id = c.current_question_version_id
      where c.id = ${intent.casting_session_id}
    `;
    const casting = castingRows[0];
    if (!casting) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    const context = decryptJson<{ context: string }>({
      v: casting.encryption_key_version,
      iv: casting.iv,
      tag: casting.auth_tag,
      data: casting.ciphertext,
    }, "context", `${casting.id}:${casting.question_id}`).context;
    const composite = normalizeComposite(casting.scene, casting.interpretation_goal, context);
    const candidates = config.keys.questionFingerprint.read.map((key) => ({
      keyVersion: key.version,
      fingerprint: fingerprintQuestion(composite, key.value, key.version),
    }));
    const writeKey = resolveWriteKey(config.keys.questionFingerprint);
    const nonceKey = resolveVersionedKey(config.keys.sessionSigning, intent.nonce_key_version);
    return this.atomicRepository.consumeLoginIntentAndReveal({
      intentId: input.intentId,
      nonceHash: hashLoginIntentNonce(input.nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      authenticatedUserId: input.authenticatedUserId,
      callbackPath,
      fingerprintCandidates: candidates,
      writeFingerprint: candidates.find((candidate) => candidate.keyVersion === writeKey.version)!,
      now: this.dependencies.clock.now(),
    });
  }

  private assertOwned(row: Record<string, unknown> | undefined, userId: string | null, anonymousHash: string | null): void {
    if (!row || !this.isOwned(row, userId, anonymousHash) || row.deleted_at) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found.", false);
    }
  }

  private isOwned(row: Record<string, unknown>, userId: string | null, anonymousHash: string | null): boolean {
    if (userId != null) return row.user_id === userId;
    if (anonymousHash != null) return row.anonymous_session_hash === anonymousHash;
    return false;
  }

  private assertMutable(casting: Record<string, unknown>, method: CastingMethod): void {
    if (casting.method !== method) throw new DomainError("CASTING_METHOD_MISMATCH", "Casting method mismatch.", false);
    const now = this.dependencies.clock.now();
    const expiresAt = date(casting.casting_expires_at);
    if (casting.lifecycle === "expired" || (casting.lifecycle === "casting" && expiresAt && expiresAt.getTime() <= now.getTime())) {
      throw new DomainError("CASTING_EXPIRED", "This casting has expired.", false);
    }
    if (!["draft", "casting"].includes(String(casting.lifecycle))) {
      throw new DomainError("CASTING_NOT_ACTIVE", "This casting cannot be changed in its current state.", false);
    }
    if (casting.risk_status === "emergency_blocked") {
      throw new DomainError("RISK_BLOCKED", "This casting cannot continue.", false);
    }
  }

  private async markIrreversible(tx: Sql, casting: Record<string, unknown>, now: Date): Promise<void> {
    if (casting.first_irreversible_step_at == null) {
      await tx`
        update casting_sessions set lifecycle = 'casting', first_irreversible_step_at = ${now},
          casting_expires_at = ${new Date(now.getTime() + 24 * HOUR_MS)}, updated_at = ${now}
        where id = ${casting.id}
      `;
    } else {
      await tx`update casting_sessions set updated_at = ${now} where id = ${casting.id}`;
    }
  }

  private async persistResult(
    tx: Sql,
    casting: Record<string, unknown>,
    lineValues: LineValue[],
    methodCalculation: unknown,
    now: Date,
  ): Promise<void> {
    const result = buildHexagramResult({
      lineValuesBottomUp: lineValues,
      method: casting.method as CastingMethod,
      algorithmVersion: String(casting.algorithm_version),
    });
    const resultHmac = hmac(JSON.stringify({
      l: result.lineValuesBottomUp,
      p: result.primaryHexagramNumber,
      m: result.movingLinePositions,
      r: result.relatingHexagramNumber,
      a: result.algorithmVersion,
      c: result.classicMappingVersion,
    }), "result");
    await tx`
      insert into cast_results (
        casting_session_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, result_hmac, algorithm_version,
        classic_mapping_version, created_at
      ) values (
        ${casting.id}, ${tx.json([...result.lineValuesBottomUp] as never)}, ${result.primaryHexagramNumber},
        ${tx.json([...result.movingLinePositions] as never)}, ${result.relatingHexagramNumber},
        ${tx.json(methodCalculation as never)}, ${resultHmac}, ${result.algorithmVersion},
        ${result.classicMappingVersion}, ${now}
      ) on conflict (casting_session_id) do nothing
    `;
    await tx`
      update casting_sessions set lifecycle = 'awaiting_reveal', completed_at = ${now},
        reveal_expires_at = ${new Date(now.getTime() + 24 * HOUR_MS)}, updated_at = ${now}
      where id = ${casting.id}
    `;
  }

  private async readQuestion(tx: Sql, casting: Record<string, unknown>): Promise<string> {
    const rows = await tx`select * from question_versions where id = ${casting.current_question_version_id}`;
    const question = rows[0];
    if (!question) return "";
    return decryptJson<{ context: string }>({
      v: question.encryption_key_version,
      iv: question.iv,
      tag: question.auth_tag,
      data: question.ciphertext,
    }, "context", `${casting.id}:${question.id}`).context;
  }
}
