import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import type {
  CastingMethod,
  HexagramResult,
  InterpretationGoal,
  Scene,
} from "@/domain/casting/types";
import { readingVariantFor } from "@/domain/generation/assemble-report";
import type { RiskDecision } from "@/domain/risk/engine";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { calculateResultIntegrityHmac } from "@/server/generation/integrity";
import { encryptQuestionForStorage, fingerprintQuestion } from "@/server/generation/question-crypto";

type RuntimeEnv = Record<string, string | undefined>;

/**
 * How long after a claim an identical resubmission is treated as the same cast
 * rather than a new one. Long enough to absorb a double click, a retried
 * request or a reloaded tab; short enough that deliberately asking the same
 * question again later still produces its own reading.
 */
const IDEMPOTENCY_WINDOW = "10 minutes";

export type AttestedCastInput = {
  userId: string;
  method: CastingMethod;
  scene: Scene;
  interpretationGoal: InterpretationGoal;
  question: string;
  /** Recomputed server-side from the submitted line values — never client supplied. */
  facts: HexagramResult;
  risk: RiskDecision;
};

export type AttestedCastResult = {
  castingId: string;
  /** True when an identical cast inside the idempotency window was returned instead of a new row. */
  reused: boolean;
};

export interface PostgresCastingRepository {
  /**
   * Atomically write one finished, already-revealed cast: the session, its
   * encrypted question and its result. This is deliberately not the full
   * draft → casting → awaiting_reveal → revealed state machine — a claimed
   * browser cast arrives complete, so there is no intermediate state to model.
   */
  persistAttestedCast(input: AttestedCastInput): Promise<AttestedCastResult>;
}

function deterministicFacts(facts: HexagramResult): DeterministicFacts {
  return {
    method: facts.method,
    algorithmVersion: facts.algorithmVersion,
    classicMappingVersion: facts.classicMappingVersion,
    lineValuesBottomUp: [...facts.lineValuesBottomUp] as DeterministicFacts["lineValuesBottomUp"],
    primaryHexagramNumber: facts.primaryHexagramNumber,
    movingLinePositions: [...facts.movingLinePositions],
    relatingHexagramNumber: facts.relatingHexagramNumber,
    readingVariant: readingVariantFor(facts.movingLinePositions),
  };
}

/**
 * An emergency block is the one risk outcome the lifecycle itself records.
 * Everything else keeps the revealed lifecycle and is distinguished by
 * risk_status, which every downstream generation path already checks for
 * exactly `allowed`.
 */
function lifecycleFor(risk: RiskDecision): "revealed" | "emergency_blocked" {
  return risk.status === "emergency_blocked" ? "emergency_blocked" : "revealed";
}

export function createPostgresCastingRepository(
  dependencies: { sql: Sql; env?: RuntimeEnv },
): PostgresCastingRepository {
  const { sql } = dependencies;
  const env = dependencies.env ?? process.env;

  return {
    async persistAttestedCast(input) {
      const { fingerprint, fingerprintKeyVersion } = fingerprintQuestion(input.question, env);
      const facts = deterministicFacts(input.facts);
      const lineValues = [...input.facts.lineValuesBottomUp];
      const movingLinePositions = [...input.facts.movingLinePositions];

      return sql.begin(async (transaction) => {
        // Serialise concurrent identical claims. Without this, a double-submit
        // can have both requests miss the duplicate lookup and insert twice;
        // the window is time-based so a unique index cannot express it.
        const lockKey = [
          input.userId,
          fingerprint,
          input.facts.primaryHexagramNumber,
          lineValues.join(","),
        ].join("|");
        await transaction`select pg_advisory_xact_lock(hashtext(${lockKey}))`;

        const existing = await transaction`
          select c.id
          from casting_sessions c
          join cast_results r on r.casting_id = c.id
          where c.user_id = ${input.userId}
            and c.cast_origin = 'client_attested'
            and c.question_fingerprint = ${fingerprint}
            and c.deleted_at is null
            and c.created_at > clock_timestamp() - ${IDEMPOTENCY_WINDOW}::interval
            and r.line_values = ${lineValues}::integer[]
            and r.primary_hexagram_number = ${input.facts.primaryHexagramNumber}
          order by c.created_at desc
          limit 1
        ` as { id: string }[];
        const reused = existing[0];
        if (reused) return { castingId: String(reused.id), reused: true };

        // Both ids are minted here rather than by the database default: the
        // question ciphertext is bound to the casting/question pair as AAD, so
        // the values must exist before the row is encrypted.
        const castingId = randomUUID();
        const questionVersionId = randomUUID();

        const encrypted = encryptQuestionForStorage(input.question, castingId, questionVersionId, env);
        const integrity = calculateResultIntegrityHmac(facts, env);

        await transaction`
          insert into casting_sessions (
            id, user_id, method, lifecycle, cast_origin, risk_status, risk_rule_version,
            scene, interpretation_goal, question_fingerprint, fingerprint_key_version
          ) values (
            ${castingId}, ${input.userId}, ${input.method}, ${lifecycleFor(input.risk)},
            'client_attested', ${input.risk.status}, ${input.risk.ruleVersion},
            ${input.scene}, ${input.interpretationGoal}, ${fingerprint}, ${fingerprintKeyVersion}
          )
        `;

        await transaction`
          insert into question_versions (
            id, casting_id, version_number, ciphertext, iv, auth_tag,
            encryption_key_version, fingerprint_key_version, fingerprint, created_reason
          ) values (
            ${questionVersionId}, ${castingId}, 1, ${encrypted.ciphertext}, ${encrypted.iv},
            ${encrypted.authTag}, ${encrypted.encryptionKeyVersion}, ${fingerprintKeyVersion},
            ${fingerprint}, 'initial'
          )
        `;

        await transaction`
          insert into cast_results (
            casting_id, line_values, primary_hexagram_number, moving_line_positions,
            relating_hexagram_number, method_calculation, algorithm_version,
            classic_mapping_version, result_hmac, result_hmac_key_version
          ) values (
            ${castingId}, ${lineValues}, ${input.facts.primaryHexagramNumber}, ${movingLinePositions},
            ${input.facts.relatingHexagramNumber},
            ${JSON.stringify({
              kind: "client_attested",
              method: input.facts.method,
              algorithmVersion: input.facts.algorithmVersion,
              note: "Line values were produced in the reader's browser and submitted; the hexagram, moving lines and relating hexagram were recomputed server-side from those values.",
            })},
            ${input.facts.algorithmVersion}, ${input.facts.classicMappingVersion},
            ${integrity.hmac}, ${integrity.version}
          )
        `;

        return { castingId, reused: false };
      });
    },
  };
}
