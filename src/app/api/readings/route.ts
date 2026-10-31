import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { getActiveResultIntegrityKey, resultIntegrityHmac } from "@/server/generation/integrity";
import { encryptQuestionForStorage, getActiveQuestionFingerprintKey } from "@/server/generation/question-crypto";
import { normalizeComposite, normalizeQuestion, fingerprintQuestion } from "@/domain/questions/normalize";
import { getPostgresClient } from "@/server/db/client";
import { repo } from "@/server/repository";
import { evaluateRisk, RISK_RULE_VERSION } from "@/domain/risk/engine";
import { meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";
import { ALGORITHM_VERSIONS, type CastingMethod } from "@/domain/casting/types";
import { normalizeScene } from "@/domain/casting/types";
import { readRequestBody, RequestBodyTooLargeError } from "@/server/http/read-request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16 * 1024;
const READING_WRITE_WINDOW_SECONDS = 60;
const READING_WRITES_PER_WINDOW = 12;

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    ...extra,
  });
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: headers() });
}

const lineValueSchema = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]);

const saveReadingSchema = z.object({
  clientCastingId: z.string().uuid(),
  method: z.enum(["three_coin", "yarrow_stalk", "mei_hua_current_time"]).default("three_coin"),
  algorithmVersion: z.string().max(80).optional(),
  methodCalculation: z.unknown().optional(),
  lineValuesBottomUp: z.array(lineValueSchema).length(6),
  question: z.string().trim().max(1000).optional(),
  scene: z.enum(["career", "relationships", "wealth", "timing", "choices", "personal_growth", "other", "general", "decision", "spiritual", "relationship", "growth"]).default("general"),
  interpretationGoal: z.enum([
    "what_do_i_need_to_see_clearly",
    "what_should_i_pay_attention_to_next",
    "how_should_i_act",
    "what_is_the_likely_direction",
  ]).default("what_do_i_need_to_see_clearly"),
});

type ExistingSavedReading = {
  id: string;
  user_id: string | null;
  scene: string;
  interpretation_goal: string;
  question_fingerprint: string | null;
  deleted_at: Date | string | null;
  line_values: number[] | null;
  method: CastingMethod;
  algorithm_version: string;
  method_calculation: Record<string, unknown>;
};

function sameNumberArray(left: readonly number[] | null, right: readonly number[]): boolean {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => Number(value) === right[index]);
}

function matchesStableSave(
  row: ExistingSavedReading,
  input: {
    method: CastingMethod;
    algorithmVersion: string;
    methodCalculation: Record<string, unknown>;
    userId: string;
    scene: string;
    interpretationGoal: string;
    questionFingerprints: readonly (string | null)[];
    lineValuesBottomUp: readonly number[];
  },
): boolean {
  return row.method === input.method
    && row.algorithm_version === input.algorithmVersion
    && JSON.stringify(canonicalJson(row.method_calculation)) === JSON.stringify(canonicalJson(input.methodCalculation))
    && row.deleted_at == null
    && row.user_id === input.userId
    && normalizeScene(row.scene) === input.scene
    && row.interpretation_goal === input.interpretationGoal
    && input.questionFingerprints.includes(row.question_fingerprint)
    && sameNumberArray(row.line_values, input.lineValuesBottomUp);
}


function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalJson(item)]));
  return value;
}

const yarrowChangeSchema = z.object({
  lineIndex: z.number().int().min(0).max(5), changeIndex: z.number().int().min(0).max(2),
  startingStalks: z.number().int().min(24).max(49), leftGroup: z.number().int().min(1).max(48),
  rightGroup: z.number().int().min(1).max(48), removedFromRight: z.literal(1),
  leftRemainder: z.number().int().min(1).max(4), rightRemainder: z.number().int().min(1).max(4),
  endingStalks: z.number().int().min(24).max(44), algorithmVersion: z.literal(ALGORITHM_VERSIONS.yarrow_stalk),
}).strict();

function validatedMethodCalculation(input: z.infer<typeof saveReadingSchema>): Record<string, unknown> | null {
  const version = ALGORITHM_VERSIONS[input.method];
  if (input.algorithmVersion !== undefined && input.algorithmVersion !== version) return null;
  if (input.method === "three_coin") return { kind: "three-coin", version };
  if (input.method === "yarrow_stalk") {
    const parsed = z.object({ changes: z.array(yarrowChangeSchema).length(18) }).strict().safeParse(input.methodCalculation);
    if (!parsed.success) return null;
    const changes = parsed.data.changes;
    const remainder = (count: number) => count % 4 || 4;
    for (const [index, change] of changes.entries()) {
      const expectedStart = index % 3 === 0 ? 49 : changes[index - 1].endingStalks;
      const removed = change.startingStalks - change.endingStalks;
      if (change.lineIndex !== Math.floor(index / 3) || change.changeIndex !== index % 3
        || change.startingStalks !== expectedStart || change.leftGroup + change.rightGroup !== expectedStart
        || change.leftRemainder !== remainder(change.leftGroup) || change.rightRemainder !== remainder(change.rightGroup - 1)
        || removed !== 1 + change.leftRemainder + change.rightRemainder
        || !(index % 3 === 0 ? [5, 9] : [4, 8]).includes(removed)
        || (index % 3 === 2 && change.endingStalks / 4 !== input.lineValuesBottomUp[Math.floor(index / 3)])) return null;
    }
    return { kind: "yarrow-stalks", version, changes };
  }
  const parsed = z.object({ utcMillis: z.number().int().min(0).max(253402300799999), ianaTimeZone: z.string().min(1).max(100) }).strict().safeParse(input.methodCalculation);
  if (!parsed.success) return null;
  try {
    const calculated = meiHuaFromUtc(parsed.data.utcMillis, parsed.data.ianaTimeZone);
    if (!sameNumberArray(calculated.lineValuesBottomUp as number[], input.lineValuesBottomUp)) return null;
    return calculated.methodCalculation;
  } catch { return null; }
}

export async function POST(request: Request): Promise<Response> {
  if (!isStrictSameOriginRequest(request)) {
    return new Response("Forbidden", { status: 403, headers: headers() });
  }

  const session = await resolveSession(request.headers);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401, headers: headers() });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = JSON.parse(await readRequestBody(request, MAX_REQUEST_BYTES)) as unknown;
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ error: "REQUEST_BODY_TOO_LARGE" }, 413);
    return json({ error: "INVALID_JSON" }, 400);
  }

  const parsed = saveReadingSchema.safeParse(body);
  if (!parsed.success) {
    console.warn("[READING_INPUT_INVALID]", parsed.error.issues);
    return json({ error: "INVALID_READING_INPUT" }, 422);
  }

  const { clientCastingId, lineValuesBottomUp, question, scene: sceneInput, interpretationGoal, method } = parsed.data;
  const algorithmVersion = ALGORITHM_VERSIONS[method];
  const methodCalculation = validatedMethodCalculation(parsed.data);
  if (!methodCalculation) return json({ error: "INVALID_READING_INPUT" }, 422);
  const scene = normalizeScene(sceneInput);
  if (!scene) return json({ error: "INVALID_READING_INPUT" }, 422);
  const questionText = question && question.trim().length > 0 ? question.trim() : null;
  let fingerprintKey: ReturnType<typeof getActiveQuestionFingerprintKey> | null = null;
  try {
    fingerprintKey = questionText ? getActiveQuestionFingerprintKey() : null;
  } catch {
    return json({ error: "QUESTION_FINGERPRINT_KEY_UNAVAILABLE" }, 503);
  }
  const fingerprintKeyVersion = fingerprintKey?.version ?? "v1";
  let fingerprint: string | null = null;
  if (questionText) {
    const composite = normalizeComposite(scene, interpretationGoal as any, questionText);
    if (!fingerprintKey) return json({ error: "QUESTION_FINGERPRINT_KEY_UNAVAILABLE" }, 503);
    fingerprint = fingerprintQuestion(composite, fingerprintKey.material, fingerprintKeyVersion);
  }
  const legacyFingerprint = questionText && sceneInput !== scene && fingerprintKey
    ? fingerprintQuestion(`${sceneInput}|${interpretationGoal}|${normalizeQuestion(questionText)}`, fingerprintKey.material, fingerprintKeyVersion)
    : null;
  const risk = questionText
    ? evaluateRisk(questionText)
    : { status: "not_checked" as const, ruleVersion: RISK_RULE_VERSION, matchedRuleCodes: [], reasonCode: "core_question_missing" };

  const hexResult = buildHexagramResult({ lineValuesBottomUp, method });
  const movingLinePositions = hexResult.movingLinePositions;
  const readingVariant = movingLinePositions.length === 0
    ? "still_hexagram"
    : movingLinePositions.length === 6
      ? "all_lines_moving"
      : movingLinePositions.length > 1
        ? "multiple_moving"
        : "standard";

  const facts: DeterministicFacts = {
    method,
    algorithmVersion,
    classicMappingVersion: "king-wen-v1",
    lineValuesBottomUp: [
      lineValuesBottomUp[0],
      lineValuesBottomUp[1],
      lineValuesBottomUp[2],
      lineValuesBottomUp[3],
      lineValuesBottomUp[4],
      lineValuesBottomUp[5],
    ],
    primaryHexagramNumber: hexResult.primaryHexagramNumber,
    movingLinePositions: [...movingLinePositions],
    relatingHexagramNumber: hexResult.relatingHexagramNumber,
    readingVariant,
  };

  const isPostgres = process.env.DATABASE_ADAPTER_MODE === "postgres" && Boolean(process.env.DATABASE_URL);

  if (isPostgres) {
    try {
      const sql = getPostgresClient();
      const identityInput = {
        method, algorithmVersion, methodCalculation,
        userId,
        scene,
        interpretationGoal,
        questionFingerprints: legacyFingerprint && legacyFingerprint !== fingerprint ? [fingerprint, legacyFingerprint] : [fingerprint],
        lineValuesBottomUp,
      };

      const findExisting = async (): Promise<ExistingSavedReading | null> => {
        const rows = await sql`
          select c.id, c.user_id, c.scene, c.interpretation_goal,
                 c.question_fingerprint, c.deleted_at, c.method, r.algorithm_version, r.method_calculation, r.line_values
          from casting_sessions c
          left join cast_results r on r.casting_id = c.id
          where c.id = ${clientCastingId}
          limit 1
        ` as ExistingSavedReading[];
        return rows[0] ?? null;
      };

      const existing = await findExisting();
      if (existing) {
        if (!matchesStableSave(existing, identityInput)) {
          return json({ error: "READING_IDEMPOTENCY_CONFLICT" }, 409);
        }
        return json({ castingId: existing.id, idempotent: true }, 200);
      }


      const key = getActiveResultIntegrityKey();
      const resultHmac = resultIntegrityHmac(facts, key);
      const resultHmacKeyVersion = key.version;
      const castingId = clientCastingId;
      const questionVersionId = randomUUID();

      let questionEncrypted = null;
      if (questionText) {
        questionEncrypted = encryptQuestionForStorage({
          castingId,
          questionVersionId,
          question: questionText,
        });
      }

      const rateLimitLockIdentity = `readings-write:${userId}`;
      const writeResult = await sql.begin(async (tx) => {
        await tx`
          select pg_advisory_xact_lock(hashtextextended(${rateLimitLockIdentity}, 0))
        `;

        const lockedExistingRows = await tx`
          select c.id, c.user_id, c.scene, c.interpretation_goal,
                 c.question_fingerprint, c.deleted_at, c.method, r.algorithm_version, r.method_calculation, r.line_values
          from casting_sessions c
          left join cast_results r on r.casting_id = c.id
          where c.id = ${clientCastingId}
          limit 1
        ` as ExistingSavedReading[];
        const lockedExisting = lockedExistingRows[0] ?? null;
        if (lockedExisting) {
          if (!matchesStableSave(lockedExisting, identityInput)) {
            return { kind: "conflict" } as const;
          }
          return { kind: "idempotent", castingId: lockedExisting.id } as const;
        }

        const recentWriteRows = await tx`
          select count(*)::integer as count
          from casting_sessions
          where user_id = ${userId}
            and created_at >= clock_timestamp() - (${READING_WRITE_WINDOW_SECONDS} * interval '1 second')
        ` as Array<{ count: number }>;
        if (Number(recentWriteRows[0]?.count ?? 0) >= READING_WRITES_PER_WINDOW) {
          return { kind: "rate_limited" } as const;
        }

        const inserted = await tx`
          insert into casting_sessions (
            id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
            interpretation_goal, question_fingerprint, fingerprint_key_version,
            generation_epoch, created_at, updated_at
          ) values (
            ${castingId}, ${userId}, ${method}, 'revealed', ${risk.status}, ${risk.ruleVersion}, ${scene},
            ${interpretationGoal}, ${fingerprint}, ${fingerprint ? fingerprintKeyVersion : null},
            0, clock_timestamp(), clock_timestamp()
          )
          on conflict (id) do nothing
          returning id
        ` as Array<{ id: string }>;

        if (!inserted[0]?.id) return { kind: "insert_conflict" } as const;

        await tx`
          insert into cast_results (
            casting_id, line_values, primary_hexagram_number, moving_line_positions,
            relating_hexagram_number, method_calculation, algorithm_version,
            classic_mapping_version, result_hmac, result_hmac_key_version, created_at
          ) values (
            ${castingId}, ${facts.lineValuesBottomUp}, ${facts.primaryHexagramNumber}, ${facts.movingLinePositions},
            ${facts.relatingHexagramNumber}, ${JSON.stringify(methodCalculation)},
            ${facts.algorithmVersion}, ${facts.classicMappingVersion}, ${resultHmac}, ${resultHmacKeyVersion}, clock_timestamp()
          )
        `;

        if (questionEncrypted) {
          await tx`
            insert into question_versions (
              id, casting_id, version_number, ciphertext, iv, auth_tag,
              encryption_key_version, fingerprint_key_version, fingerprint,
              created_reason, created_at
            ) values (
              ${questionVersionId}, ${castingId}, 1, ${questionEncrypted.ciphertext}, ${questionEncrypted.iv},
              ${questionEncrypted.authTag}, ${questionEncrypted.encryptionKeyVersion}, ${fingerprintKeyVersion},
              ${fingerprint}, 'initial', clock_timestamp()
            )
          `;
        }

        if (fingerprint) {
          const lockRows = await tx`
            insert into question_locks (
              user_id, fingerprint, key_version, winning_casting_id, locked_until, created_at, updated_at
            ) values (
              ${userId}, ${fingerprint}, ${fingerprintKeyVersion}, ${castingId},
              clock_timestamp() + interval '72 hours', clock_timestamp(), clock_timestamp()
            )
            on conflict (user_id, fingerprint) do update
            set key_version = excluded.key_version,
                winning_casting_id = excluded.winning_casting_id,
                locked_until = excluded.locked_until,
                updated_at = clock_timestamp()
            where question_locks.winning_casting_id = excluded.winning_casting_id
               or question_locks.locked_until <= clock_timestamp()
            returning winning_casting_id
          ` as Array<{ winning_casting_id: string }>;
          if (!lockRows[0]) {
            const existingLock = await tx`
              select winning_casting_id from question_locks
              where user_id = ${userId} and fingerprint = ${fingerprint} limit 1
            ` as Array<{ winning_casting_id: string }>;
            throw new Error(`QUESTION_LOCKED:${String(existingLock[0]?.winning_casting_id ?? "unknown")}`);
          }
        }

        return { kind: "created" } as const;
      });

      if (writeResult.kind === "idempotent") {
        return json({ castingId: writeResult.castingId, idempotent: true }, 200);
      }
      if (writeResult.kind === "conflict") {
        return json({ error: "READING_IDEMPOTENCY_CONFLICT" }, 409);
      }
      if (writeResult.kind === "rate_limited") {
        return json({ error: "READING_RATE_LIMITED" }, 429);
      }
      if (writeResult.kind === "insert_conflict") {
        const raced = await findExisting();
        if (!raced || !matchesStableSave(raced, identityInput)) {
          return json({ error: "READING_IDEMPOTENCY_CONFLICT" }, 409);
        }
        return json({ castingId: raced.id, idempotent: true }, 200);
      }

      return json({ castingId, idempotent: false }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("QUESTION_LOCKED:")) {
        return json({ error: "QUESTION_LOCKED", previousCastingId: message.slice("QUESTION_LOCKED:".length) }, 409);
      }
      console.error("[SAVE_READING_ROUTE_ERROR]", error);
      return json({ error: "SAVE_READING_FAILED" }, 500);
    }
  }

  // Local/test memory mode keeps its existing repository semantics. Production
  // idempotency is enforced by the stable UUID persisted as casting_sessions.id.
  const memorySession = repo.createCastingSession({
    userId,
    anonHash: null,
    method,
    scene,
    interpretationGoal: interpretationGoal as any,
    algorithmVersion,
  });
  repo.saveCastResult({
    castingSessionId: memorySession.id,
    lineValues: [...lineValuesBottomUp],
    methodCalculation,
  });
  repo.transitionCasting(memorySession.id, "casting");
  repo.transitionCasting(memorySession.id, "awaiting_reveal");
  repo.transitionCasting(memorySession.id, "revealed");
  repo.recordRiskCheck({
    castingSessionId: memorySession.id,
    ruleVersion: risk.ruleVersion,
    matchedRuleCodes: risk.matchedRuleCodes,
    reasonCode: risk.reasonCode,
    status: risk.status,
  });
  return json({ castingId: memorySession.id, idempotent: false }, 201);
}
