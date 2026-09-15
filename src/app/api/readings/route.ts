import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveSession } from "@/lib/auth/session";
import { isStrictSameOriginRequest } from "@/server/http/origin-guard";
import { buildHexagramResult } from "@/domain/casting/hexagrams/compute";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { getActiveResultIntegrityKey, resultIntegrityHmac } from "@/server/generation/integrity";
import { encryptQuestionForStorage } from "@/server/generation/question-crypto";
import { normalizeComposite, fingerprintQuestion } from "@/domain/questions/normalize";
import { getPostgresClient } from "@/server/db/client";
import { repo } from "@/server/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  lineValuesBottomUp: z.array(lineValueSchema).length(6),
  question: z.string().trim().max(1000).optional(),
  scene: z.enum(["general", "career", "relationships", "decision", "timing", "wealth", "spiritual"]).default("general"),
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
};

function sameNumberArray(left: readonly number[] | null, right: readonly number[]): boolean {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => Number(value) === right[index]);
}

function matchesStableSave(
  row: ExistingSavedReading,
  input: {
    userId: string;
    scene: string;
    interpretationGoal: string;
    questionFingerprint: string | null;
    lineValuesBottomUp: readonly number[];
  },
): boolean {
  return row.deleted_at == null
    && row.user_id === input.userId
    && row.scene === input.scene
    && row.interpretation_goal === input.interpretationGoal
    && row.question_fingerprint === input.questionFingerprint
    && sameNumberArray(row.line_values, input.lineValuesBottomUp);
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
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const parsed = saveReadingSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "INVALID_READING_INPUT", details: parsed.error.issues }, 422);
  }

  const { clientCastingId, lineValuesBottomUp, question, scene, interpretationGoal } = parsed.data;
  const questionText = question && question.trim().length > 0 ? question.trim() : null;
  const fingerprintKeyVersion = "v1";
  let fingerprint: string | null = null;
  if (questionText) {
    const composite = normalizeComposite(scene as any, interpretationGoal as any, questionText);
    const secret = process.env.APP_SECRET ?? "fallback-question-secret";
    fingerprint = fingerprintQuestion(composite, secret, fingerprintKeyVersion);
  }

  const hexResult = buildHexagramResult({ lineValuesBottomUp, method: "three_coin" });
  const movingLinePositions = hexResult.movingLinePositions;
  const readingVariant = movingLinePositions.length === 0
    ? "still_hexagram"
    : movingLinePositions.length === 6
      ? "all_lines_moving"
      : movingLinePositions.length > 1
        ? "multiple_moving"
        : "standard";

  const facts: DeterministicFacts = {
    method: "three_coin",
    algorithmVersion: "three-coin-v1",
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
        userId,
        scene,
        interpretationGoal,
        questionFingerprint: fingerprint,
        lineValuesBottomUp,
      };

      const findExisting = async (): Promise<ExistingSavedReading | null> => {
        const rows = await sql`
          select c.id, c.user_id, c.scene, c.interpretation_goal,
                 c.question_fingerprint, c.deleted_at, r.line_values
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

      const created = await sql.begin(async (tx) => {
        const inserted = await tx`
          insert into casting_sessions (
            id, user_id, method, lifecycle, risk_status, scene,
            interpretation_goal, question_fingerprint, fingerprint_key_version,
            generation_epoch, created_at, updated_at
          ) values (
            ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', ${scene},
            ${interpretationGoal}, ${fingerprint}, ${fingerprint ? fingerprintKeyVersion : null},
            0, clock_timestamp(), clock_timestamp()
          )
          on conflict (id) do nothing
          returning id
        ` as Array<{ id: string }>;

        if (!inserted[0]?.id) return false;

        await tx`
          insert into cast_results (
            casting_id, line_values, primary_hexagram_number, moving_line_positions,
            relating_hexagram_number, method_calculation, algorithm_version,
            classic_mapping_version, result_hmac, result_hmac_key_version, created_at
          ) values (
            ${castingId}, ${facts.lineValuesBottomUp}, ${facts.primaryHexagramNumber}, ${facts.movingLinePositions},
            ${facts.relatingHexagramNumber}, ${JSON.stringify({ kind: "three-coin", version: "three-coin-v1" })},
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

        return true;
      });

      if (!created) {
        const raced = await findExisting();
        if (!raced || !matchesStableSave(raced, identityInput)) {
          return json({ error: "READING_IDEMPOTENCY_CONFLICT" }, 409);
        }
        return json({ castingId: raced.id, idempotent: true }, 200);
      }

      return json({ castingId, idempotent: false }, 201);
    } catch (error) {
      console.error("[SAVE_READING_ROUTE_ERROR]", error);
      return json({ error: "SAVE_READING_FAILED" }, 500);
    }
  }

  // Local/test memory mode keeps its existing repository semantics. Production
  // idempotency is enforced by the stable UUID persisted as casting_sessions.id.
  const memorySession = repo.createCastingSession({
    userId,
    anonHash: null,
    method: "three_coin",
    scene: scene as any,
    interpretationGoal: interpretationGoal as any,
    algorithmVersion: "three-coin-v1",
  });
  repo.saveCastResult({
    castingSessionId: memorySession.id,
    lineValues: [...lineValuesBottomUp],
    methodCalculation: { kind: "three-coin", version: "three-coin-v1" },
  });
  repo.transitionCasting(memorySession.id, "casting");
  repo.transitionCasting(memorySession.id, "awaiting_reveal");
  repo.transitionCasting(memorySession.id, "revealed");
  return json({ castingId: memorySession.id, idempotent: false }, 201);
}
