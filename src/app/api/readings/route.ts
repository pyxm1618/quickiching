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

  const { lineValuesBottomUp, question, scene, interpretationGoal } = parsed.data;
  const questionText = question && question.trim().length > 0 ? question.trim() : null;

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

      // 幂等性检查：1小时内相同用户、相同六爻、未删除的记录直接复用
      const existingRows = await sql`
        select c.id
        from casting_sessions c
        join cast_results r on r.casting_id = c.id
        where c.user_id = ${userId}
          and c.deleted_at is null
          and c.lifecycle = 'revealed'
          and r.line_values = ${lineValuesBottomUp}
          and c.created_at > clock_timestamp() - interval '1 hour'
        order by c.created_at desc
        limit 1
      ` as Array<{ id: string }>;

      if (existingRows[0]?.id) {
        return json({ castingId: existingRows[0].id, idempotent: true }, 200);
      }

      const key = getActiveResultIntegrityKey();
      const resultHmac = resultIntegrityHmac(facts, key);
      const resultHmacKeyVersion = key.version;

      const castingId = randomUUID();
      const questionVersionId = randomUUID();

      let questionEncrypted = null;
      let fingerprint: string | null = null;
      const fingerprintKeyVersion = "v1";

      if (questionText) {
        questionEncrypted = encryptQuestionForStorage({
          castingId,
          questionVersionId,
          question: questionText,
        });
        const composite = normalizeComposite(scene as any, interpretationGoal as any, questionText);
        const secret = process.env.APP_SECRET ?? "fallback-question-secret";
        fingerprint = fingerprintQuestion(composite, secret, fingerprintKeyVersion);
      }

      await sql.begin(async (tx) => {
        await tx`
          insert into casting_sessions (
            id, user_id, method, lifecycle, risk_status, scene,
            interpretation_goal, question_fingerprint, fingerprint_key_version,
            generation_epoch, created_at, updated_at
          ) values (
            ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', ${scene},
            ${interpretationGoal}, ${fingerprint}, ${fingerprint ? fingerprintKeyVersion : null},
            0, clock_timestamp(), clock_timestamp()
          )
        `;

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
      });

      return json({ castingId, idempotent: false }, 201);
    } catch (error) {
      console.error("[SAVE_READING_ROUTE_ERROR]", error);
      return json({ error: "SAVE_READING_FAILED" }, 500);
    }
  }

  // 内存模式降级
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
