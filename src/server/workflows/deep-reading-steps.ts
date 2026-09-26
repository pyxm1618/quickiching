import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getPostgresClient } from "@/server/db/client";
import type { DeterministicFacts } from "@/domain/generation/schemas";
import { readingReportSchema, validateDeepReadingEvidence, type DeepReadingContextSnapshot } from "@/domain/generation/deep-reading-contract";
import { createAiSdkDeepReadingProvider, createAiSdkOutputReviewer, reviewDecisionPassed } from "@/server/generation/ai-sdk-provider";
import { getServerConfig } from "@/server/config";
import type { OutputReviewDecision, ProviderGenerationResult, ProviderInput } from "@/server/generation/types";
import {
  calculateDeepReadingResultIntegrity,
  calculateDeepReadingContextSnapshotHash,
  verifyResultIntegrity,
} from "@/server/generation/integrity";
import { decryptDeepReadingContextSnapshot } from "@/server/generation/deep-reading-snapshot";
import { evaluateRisk } from "@/domain/risk/engine";
import type { Scene } from "@/domain/casting/types";

type Row = Record<string, any>;
const LEASE_DURATION_MS = 5 * 60 * 1000;

function readingVariant(movingLinePositions: number[]): DeterministicFacts["readingVariant"] {
  if (movingLinePositions.length === 0) return "still_hexagram";
  if (movingLinePositions.length === 6) return "all_lines_moving";
  if (movingLinePositions.length > 1) return "multiple_moving";
  return "standard";
}

function factsFromSession(session: Row): DeterministicFacts {
  const lineValues = (session.line_values as number[]) ?? [];
  const movingLinePositions = (session.moving_line_positions as number[]) ?? [];
  return {
    method: session.method as any,
    algorithmVersion: String(session.algorithm_version),
    classicMappingVersion: String(session.classic_mapping_version),
    lineValuesBottomUp: [
      Number(lineValues[0]), Number(lineValues[1]), Number(lineValues[2]),
      Number(lineValues[3]), Number(lineValues[4]), Number(lineValues[5]),
    ] as any,
    primaryHexagramNumber: Number(session.primary_hexagram_number),
    movingLinePositions,
    relatingHexagramNumber: session.relating_hexagram_number ? Number(session.relating_hexagram_number) : null,
    readingVariant: readingVariant(movingLinePositions),
  };
}

function contextRiskText(snapshot: DeepReadingContextSnapshot): string {
  return [snapshot.coreQuestionAtCast, snapshot.context.contextNotes, ...snapshot.context.options,
    ...snapshot.context.constraints, ...snapshot.context.concerns].filter(Boolean).join("\n");
}

async function loadDeepReadingSnapshot(
  transaction: TransactionSql,
  castingId: string,
): Promise<{ snapshot: DeepReadingContextSnapshot; snapshotHash: string }> {
  const rows = await transaction`
    select ciphertext, iv, auth_tag, encryption_key_version, snapshot_hash
    from deep_reading_context_snapshots where casting_id = ${castingId} limit 1
  ` as Row[];
  const row = rows[0];
  if (!row) throw new Error("DEEP_READING_CONTEXT_SNAPSHOT_REQUIRED");
  const snapshot = decryptDeepReadingContextSnapshot(castingId, {
    ciphertext: String(row.ciphertext),
    iv: String(row.iv),
    authTag: String(row.auth_tag),
    encryptionKeyVersion: String(row.encryption_key_version),
  });
  const snapshotHash = calculateDeepReadingContextSnapshotHash(snapshot);
  if (snapshotHash !== String(row.snapshot_hash)) throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
  return { snapshot, snapshotHash };
}

async function loadLockedSession(transaction: TransactionSql, castingId: string): Promise<Row> {
  const rows = await transaction`
    select
      c.id, c.id as casting_id, c.user_id, c.deleted_at, c.generation_epoch, c.lifecycle, c.risk_status,
      c.scene, c.interpretation_goal, c.method,
      q.id as question_version_id, q.ciphertext as question_ciphertext,
      q.iv as question_iv, q.auth_tag as question_auth_tag,
      q.encryption_key_version as question_encryption_key_version,
      r.line_values, r.primary_hexagram_number, r.moving_line_positions,
      r.relating_hexagram_number, r.algorithm_version, r.classic_mapping_version,
      r.result_hmac, r.result_hmac_key_version
    from casting_sessions c
    left join lateral (
      select * from question_versions
      where casting_id = c.id
      order by version_number desc
      limit 1
    ) q on true
    left join cast_results r on r.casting_id = c.id
    where c.id = ${castingId}
    limit 1
    for update of c
  ` as Row[];
  if (!rows[0]) throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
  return rows[0];
}

export async function claimJobLeaseStep(input: {
  castingId: string;
  jobId: string;
  idempotencyKey: string;
  generationEpoch: number;
}): Promise<{ leaseToken: string; providerInput: ProviderInput; inputSnapshotHash: string }> {
  "use step";
  const sql = getPostgresClient();

  return sql.begin(async (transaction: TransactionSql) => {
    const session = await loadLockedSession(transaction, input.castingId);
    if (session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }
    if (session.lifecycle !== "revealed") throw new Error("CASTING_NOT_READY");
    if (session.method !== "three_coin") throw new Error("UNSUPPORTED_CAST_METHOD");
    if (!session.result_hmac) throw new Error("CAST_RESULT_UNAVAILABLE");

    const jobRows = await transaction`
      select * from generation_jobs
      where id = ${input.jobId} and casting_id = ${input.castingId}
      limit 1
      for update
    ` as Row[];
    const job = jobRows[0];
    if (!job || Number(job.generation_epoch) !== input.generationEpoch) {
      throw new Error("GENERATION_JOB_INVALID");
    }
    if (job.status !== "queued" && job.status !== "running") {
      throw new Error("GENERATION_JOB_NOT_ACTIVE");
    }

    const facts = factsFromSession(session);
    const { snapshot, snapshotHash } = await loadDeepReadingSnapshot(transaction, input.castingId);
    const storedSnapshotHash = String(job.input_snapshot_hash);
    if (!storedSnapshotHash || snapshotHash !== storedSnapshotHash) {
      throw new Error("INPUT_SNAPSHOT_MISMATCH");
    }
    if (JSON.stringify(snapshot.facts) !== JSON.stringify(facts)) throw new Error("CAST_FACT_SNAPSHOT_MISMATCH");
    if (snapshot.castMethod !== session.method || snapshot.methodVersion !== facts.algorithmVersion) {
      throw new Error("CAST_METHOD_SNAPSHOT_MISMATCH");
    }
    if (snapshot.scene !== session.scene) throw new Error("CAST_SCENE_SNAPSHOT_MISMATCH");
    if (snapshot.knowledgeVersion !== snapshot.knowledge.version) throw new Error("KNOWLEDGE_SNAPSHOT_VERSION_MISMATCH");
    if (!verifyResultIntegrity({
      facts,
      resultHmac: String(session.result_hmac),
      resultHmacKeyVersion: String(session.result_hmac_key_version),
    })) throw new Error("CAST_RESULT_INTEGRITY_INVALID");
    const risk = evaluateRisk(contextRiskText(snapshot), String(snapshot.scene) as Scene);
    if (risk.status !== "allowed") throw new Error(`RISK_${risk.status.toUpperCase()}`);
    if (Date.parse(String(job.timeout_at)) <= Date.now()) throw new Error("DEEP_READING_DEADLINE_EXCEEDED");

    const leaseToken = randomUUID();
    const claimedRows = await transaction`
      update generation_jobs
      set status = 'running', lease_owner = 'workflow_worker', lease_token = ${leaseToken},
          lease_expires_at = clock_timestamp() + (${LEASE_DURATION_MS} * interval '1 millisecond'),
          attempt_count = attempt_count + 1, updated_at = clock_timestamp()
      where id = ${input.jobId} and casting_id = ${input.castingId}
        and generation_epoch = ${input.generationEpoch}
        and (
          status = 'queued'
          or (status = 'running' and lease_expires_at is not null and lease_expires_at <= clock_timestamp())
        )
      returning attempt_count
    ` as Row[];
    if (!claimedRows[0]) throw new Error("GENERATION_JOB_LEASE_ACTIVE");
    const attemptCount = Number(claimedRows[0].attempt_count);

    await transaction`
      update workflow_runs
      set status = 'running', attempt_count = greatest(attempt_count, ${attemptCount}),
          error_code = null, updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;

    return {
      leaseToken,
      providerInput: {
        castingId: input.castingId,
        question: snapshot.coreQuestionAtCast,
        scene: snapshot.scene as Scene,
        interpretationGoal: snapshot.context.interpretationGoal as ProviderInput["interpretationGoal"],
        facts,
        context: snapshot.context,
        knowledge: snapshot.knowledge,
        deadlineAt: new Date(job.timeout_at).toISOString(),
      },
      inputSnapshotHash: storedSnapshotHash,
    };
  });
}

export async function generateDeepReadingStep(input: {
  providerInput: ProviderInput;
  jobId: string;
  leaseToken: string;
}): Promise<ProviderGenerationResult> {
  "use step";
  const sql = getPostgresClient();
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() and timeout_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  try {
    const provider = await createAiSdkDeepReadingProvider();
    const generated = await provider.generateReading(input.providerInput, new AbortController().signal);
    const report = readingReportSchema.parse(generated.output);
    const knowledge = input.providerInput.knowledge;
    if (!knowledge) throw new Error("DEEP_READING_CONTEXT_UNAVAILABLE");
    const evidence = validateDeepReadingEvidence(report, knowledge, {
      primaryHexagramNumber: input.providerInput.facts.primaryHexagramNumber,
      relatingHexagramNumber: input.providerInput.facts.relatingHexagramNumber,
      movingLinePositions: input.providerInput.facts.movingLinePositions,
      readingVariant: input.providerInput.facts.readingVariant,
    });
    if (!evidence.valid) throw new Error("DEEP_READING_EVIDENCE_INVALID");
    if (JSON.stringify(generated.deterministicFacts) !== JSON.stringify(input.providerInput.facts)) {
      throw new Error("DETERMINISTIC_FACTS_MISMATCH");
    }
    return { ...generated, output: report };
  } catch (error) {
    console.error("[DEEP_READING_STEP_GENERATE_ERROR]", error);
    throw error;
  }
}

export async function reviewDeepReadingStep(input: {
  output: unknown;
  providerInput: ProviderInput;
  jobId: string;
  leaseToken: string;
}): Promise<OutputReviewDecision> {
  "use step";
  const sql = getPostgresClient();
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() and timeout_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  try {
    const reviewer = await createAiSdkOutputReviewer();
    return await reviewer.review(
      {
        kind: "deep_reading",
        output: input.output,
        facts: input.providerInput.facts,
        question: input.providerInput.question,
        scene: input.providerInput.scene,
        interpretationGoal: input.providerInput.interpretationGoal,
        context: input.providerInput.context,
        knowledge: input.providerInput.knowledge,
        deadlineAt: input.providerInput.deadlineAt,
      },
      new AbortController().signal,
    );
  } catch (error) {
    console.error("[DEEP_READING_STEP_REVIEW_ERROR]", error);
    throw error;
  }
}

export async function finalizeDeepReadingStep(input: {
  castingId: string;
  jobId: string;
  reservationId: string;
  idempotencyKey: string;
  generationEpoch: number;
  inputSnapshotHash: string;
  leaseToken: string;
  generationResult: ProviderGenerationResult;
  reviewDecision: OutputReviewDecision;
}): Promise<{ success: boolean }> {
  "use step";
  const sql = getPostgresClient();
  if (!reviewDecisionPassed(input.reviewDecision)) throw new Error("OUTPUT_REVIEW_FAILED");

  return sql.begin(async (transaction: TransactionSql) => {
    const session = await loadLockedSession(transaction, input.castingId);
    if (session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }
    if (session.lifecycle !== "revealed") throw new Error("CASTING_NOT_READY");
    if (session.risk_status !== "allowed") throw new Error("RISK_PROHIBITED");
    const facts = factsFromSession(session);
    const { snapshot, snapshotHash } = await loadDeepReadingSnapshot(transaction, input.castingId);
    if (
      JSON.stringify(snapshot.facts) !== JSON.stringify(facts)
      || snapshot.castMethod !== session.method
      || snapshot.methodVersion !== facts.algorithmVersion
    ) {
      throw new Error("CAST_FACT_SNAPSHOT_MISMATCH");
    }
    if (snapshot.scene !== session.scene) throw new Error("CAST_SCENE_SNAPSHOT_MISMATCH");
    if (snapshot.knowledgeVersion !== snapshot.knowledge.version) throw new Error("KNOWLEDGE_SNAPSHOT_VERSION_MISMATCH");
    if (evaluateRisk(contextRiskText(snapshot), String(snapshot.scene) as Scene).status !== "allowed") {
      throw new Error("RISK_PROHIBITED");
    }

    const jobRows = await transaction`
      select * from generation_jobs
      where id = ${input.jobId} and casting_id = ${input.castingId}
        and status = 'running' and lease_token = ${input.leaseToken}
        and lease_expires_at > clock_timestamp()
        and timeout_at > clock_timestamp()
      limit 1
      for update
    ` as Row[];
    const job = jobRows[0];
    if (!job || Number(job.generation_epoch) !== input.generationEpoch) {
      throw new Error("GENERATION_JOB_LEASE_INVALID");
    }
    const storedSnapshotHash = String(job.input_snapshot_hash);
    if (
      !storedSnapshotHash
      || input.inputSnapshotHash !== storedSnapshotHash
      || snapshotHash !== storedSnapshotHash
    ) {
      throw new Error("INPUT_SNAPSHOT_MISMATCH");
    }

    if (!session.result_hmac || !session.result_hmac_key_version) {
      throw new Error("CAST_RESULT_UNAVAILABLE");
    }
    if (!verifyResultIntegrity({
      facts,
      resultHmac: String(session.result_hmac),
      resultHmacKeyVersion: String(session.result_hmac_key_version),
    })) {
      throw new Error("CAST_RESULT_INTEGRITY_INVALID");
    }

    const resRows = await transaction`
      select * from entitlement_reservations
      where id = ${input.reservationId} and casting_id = ${input.castingId}
        and job_id = ${input.jobId} and status = 'reserved'
      limit 1
      for update
    ` as Row[];
    const reservation = resRows[0];
    if (!reservation || String(reservation.user_id) !== String(session.user_id)) {
      throw new Error("ENTITLEMENT_RESERVATION_INVALID");
    }

    if (JSON.stringify(input.generationResult.deterministicFacts) !== JSON.stringify(facts)) {
      throw new Error("DETERMINISTIC_FACTS_MISMATCH");
    }
    const output = readingReportSchema.parse(input.generationResult.output);
    const evidence = validateDeepReadingEvidence(output, snapshot.knowledge, {
      primaryHexagramNumber: facts.primaryHexagramNumber,
      relatingHexagramNumber: facts.relatingHexagramNumber,
      movingLinePositions: facts.movingLinePositions,
      readingVariant: facts.readingVariant,
    });
    if (!evidence.valid) throw new Error("DEEP_READING_EVIDENCE_INVALID");
    const config = getServerConfig();
    const model = config.aiModelDeepReading ?? "gemini-2.5-pro";
    const schemaVersion = "deep-reading-v2";
    const promptVersion = "deep-reading-v2";
    const provider = "vercel-ai-gateway";
    const integrity = calculateDeepReadingResultIntegrity({
      castingId: input.castingId,
      jobId: input.jobId,
      reservationId: input.reservationId,
      output,
      facts,
      schemaVersion,
      promptVersion,
      provider,
      model,
    });

    await transaction`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes,
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass,
        question_relevance_pass, context_fidelity_pass, evidence_grounding_pass,
        interpretive_coherence_pass, actionability_pass, uncertainty_pass,
        language_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${input.jobId}, ${input.castingId}, 'deep_reading',
        ${input.reviewDecision.status}, ${JSON.stringify(input.reviewDecision.reasonCodes)}::jsonb,
        'reviewer-v2', ${String(input.reviewDecision.schemaValid)},
        ${String(input.reviewDecision.safetyPass)}, ${String(input.reviewDecision.factConsistencyPass)},
        ${String(input.reviewDecision.questionRelevancePass)}, ${String(input.reviewDecision.contextFidelityPass)},
        ${String(input.reviewDecision.evidenceGroundingPass)}, ${String(input.reviewDecision.interpretiveCoherencePass)},
        ${String(input.reviewDecision.actionabilityPass)}, ${String(input.reviewDecision.uncertaintyPass)},
        ${String(input.reviewDecision.languageConsistencyPass)},
        clock_timestamp()
      ) on conflict (job_id) do nothing
    `;

    await transaction`
      insert into deep_reading_results (
        casting_id, job_id, reservation_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, integrity_key_version, persisted_at
      ) values (
        ${input.castingId}, ${input.jobId}, ${input.reservationId},
        ${JSON.stringify(output)}::jsonb, ${schemaVersion}, ${promptVersion},
        ${provider}, ${model}, ${integrity.hmac}, ${integrity.version}, clock_timestamp()
      )
    `;

    await transaction`
      update entitlement_reservations
      set status = 'consumed', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.reservationId}
    `;
    await transaction`
      update entitlement_batches
      set quantity_reserved = greatest(0, quantity_reserved - 1),
          quantity_consumed = quantity_consumed + 1, updated_at = clock_timestamp()
      where id = ${String(reservation.batch_id)}
    `;
    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, action, quantity, business_key, created_at
      )
      select ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'consume', 1,
             ${`consume:${input.jobId}`}, clock_timestamp()
      from entitlement_batches b
      where b.id = ${String(reservation.batch_id)}
      on conflict (business_key) do nothing
    `;

    await transaction`
      update generation_jobs
      set status = 'completed', completed_at = clock_timestamp(),
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.jobId}
    `;
    await transaction`
      update workflow_runs
      set status = 'completed', updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;
    await transaction`
      insert into audit_events (
        id, category, action, entity_type, entity_id, user_id, payload, created_at
      ) values (
        ${randomUUID()}, 'generation', 'deep_reading_completed', 'job', ${input.jobId},
        ${String(session.user_id)}, ${JSON.stringify({
          castingId: input.castingId,
          reservationId: input.reservationId,
          model,
          integrityKeyVersion: integrity.version,
        })}::jsonb, clock_timestamp()
      )
    `;

    return { success: true };
  });
}

export async function handleWorkflowFailureStep(input: {
  jobId: string;
  leaseToken: string;
  generationEpoch: number;
  reservationId: string;
  idempotencyKey: string;
  errorCode: string;
}): Promise<void> {
  "use step";
  const sql = getPostgresClient();

  await sql.begin(async (transaction: TransactionSql) => {
    const updatedJobs = await transaction`
      update generation_jobs
      set status = 'failed', structured_error_code = ${input.errorCode},
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.jobId} and lease_token = ${input.leaseToken}
        and generation_epoch = ${input.generationEpoch} and status = 'running'
      returning id
    ` as Row[];
    if (!updatedJobs[0]) return;

    const resRows = await transaction`
      select * from entitlement_reservations
      where id = ${input.reservationId} and status = 'reserved'
      limit 1
      for update
    ` as Row[];
    const reservation = resRows[0];

    if (reservation) {
      await transaction`
        update entitlement_reservations
        set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
        where id = ${input.reservationId}
      `;
      await transaction`
        update entitlement_batches
        set quantity_reserved = greatest(0, quantity_reserved - 1),
            quantity_available = quantity_available + 1, updated_at = clock_timestamp()
        where id = ${String(reservation.batch_id)}
      `;
      await transaction`
        insert into entitlement_ledger (
          id, batch_id, order_id, action, quantity, business_key, created_at
        )
        select ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'release', 1,
               ${`release:${input.reservationId}`}, clock_timestamp()
        from entitlement_batches b
        where b.id = ${String(reservation.batch_id)}
        on conflict (business_key) do nothing
      `;
    }

    await transaction`
      update workflow_runs
      set status = 'failed', error_code = ${input.errorCode}, updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;
    await transaction`
      insert into audit_events (
        id, category, action, entity_type, entity_id, user_id, payload, created_at
      ) values (
        ${randomUUID()}, 'generation', 'deep_reading_failed', 'job', ${input.jobId},
        ${reservation ? String(reservation.user_id) : null},
        ${JSON.stringify({ reservationId: input.reservationId, errorCode: input.errorCode })}::jsonb,
        clock_timestamp()
      )
    `;
  });
}

export async function handleUnclaimedWorkflowFailureStep(input: {
  jobId: string;
  generationEpoch: number;
  reservationId: string;
  idempotencyKey: string;
  castingId: string;
  errorCode: string;
}): Promise<void> {
  "use step";
  const sql = getPostgresClient();

  await sql.begin(async (transaction: TransactionSql) => {
    const failedJobs = await transaction`
      update generation_jobs
      set status = 'failed', structured_error_code = ${input.errorCode},
          lease_owner = null, lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.jobId} and casting_id = ${input.castingId}
        and generation_epoch = ${input.generationEpoch} and idempotency_key = ${input.idempotencyKey}
        and (
          (status = 'queued' and lease_token is null)
          or (status = 'running' and lease_expires_at is not null and lease_expires_at <= clock_timestamp())
        )
      returning id
    ` as Row[];
    if (!failedJobs[0]) return;

    const reservationRows = await transaction`
      select id, batch_id from entitlement_reservations
      where id = ${input.reservationId} and job_id = ${input.jobId} and status = 'reserved'
      limit 1 for update
    ` as Row[];
    const reservation = reservationRows[0];
    if (reservation) {
      await transaction`
        update entitlement_reservations
        set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
        where id = ${input.reservationId} and status = 'reserved'
      `;
      await transaction`
        update entitlement_batches
        set quantity_reserved = greatest(0, quantity_reserved - 1),
            quantity_available = quantity_available + 1, updated_at = clock_timestamp()
        where id = ${String(reservation.batch_id)}
      `;
      await transaction`
        insert into entitlement_ledger (id, batch_id, order_id, action, quantity, business_key, created_at)
        select ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'release', 1,
               ${`release:${input.reservationId}`}, clock_timestamp()
        from entitlement_batches b where b.id = ${String(reservation.batch_id)}
        on conflict (business_key) do nothing
      `;
    }

    await transaction`
      update workflow_runs
      set status = 'failed', error_code = ${input.errorCode}, updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;
    await transaction`
      insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
      values (
        ${randomUUID()}, 'generation', 'deep_reading_claim_failed', 'job', ${input.jobId}, null,
        ${JSON.stringify({ castingId: input.castingId, reservationId: input.reservationId, errorCode: input.errorCode })}::jsonb,
        clock_timestamp()
      )
    `;
  });
}
