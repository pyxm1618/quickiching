import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getPostgresClient } from "@/server/db/client";
import type {
  DeterministicFacts,
  CommercialReadingReportV2,
  GeneratedReading,
} from "@/domain/generation/schemas";
import {
  buildDeterministicVerdict,
  type DeterministicVerdict,
} from "@/domain/interpretation/deterministic/verdict";
import type { ContentLocale } from "@/i18n/config";
import { validateGeneratedReading } from "@/server/generation/reading-validator";
import { createAiSdkGenerationProvider, createAiSdkOutputReviewer } from "@/server/generation/ai-sdk-provider";
import { getServerConfig } from "@/server/config";
import type {
  OutputReviewDecision,
  ProviderGenerationResult,
  ReadingProviderInput,
} from "@/server/generation/types";
import {
  calculateDeepReadingInputSnapshotHash,
  calculateDeepReadingResultIntegrity,
} from "@/server/generation/integrity";
import { decryptQuestionForGeneration } from "@/server/generation/question-crypto";

type Row = Record<string, any>;
const LEASE_DURATION_MS = 5 * 60 * 1000;

function readingVariant(movingLinePositions: number[]): DeterministicFacts["readingVariant"] {
  if (movingLinePositions.length === 0) return "still_hexagram";
  if (movingLinePositions.length === 6) return "all_lines_moving";
  if (movingLinePositions.length > 1) return "multiple_moving";
  return "standard";
}

// The deterministic verdict is derived from the already-verified cast facts, so
// it can be rebuilt at any step without re-reading the database.
function verdictFromFacts(facts: DeterministicFacts): DeterministicVerdict {
  return buildDeterministicVerdict({
    lineValuesBottomUp: facts.lineValuesBottomUp,
    primaryHexagramNumber: facts.primaryHexagramNumber,
    movingLinePositions: facts.movingLinePositions,
    relatingHexagramNumber: facts.relatingHexagramNumber,
    method: facts.method,
    algorithmVersion: facts.algorithmVersion,
    classicMappingVersion: facts.classicMappingVersion,
  });
}

const DISCLAIMER: Record<ContentLocale, string> = {
  "zh-Hans": "本解读用于反思与自我澄清，不构成决定论预言，也不替代医疗、法律、财务或其他专业建议。",
  en: "This reading is for reflection and self-clarification. It is not a deterministic prediction"
    + " and does not replace medical, legal, financial or other professional advice.",
};

// Joins the code-computed half and the model-written half into the stored
// report. The deterministic fields are copied from the verdict, never from the
// model's output, so what the reader sees as "依据" cannot drift.
function assembleReadingReport(
  verdict: DeterministicVerdict,
  generated: GeneratedReading,
  facts: DeterministicFacts,
  locale: ContentLocale,
): CommercialReadingReportV2 {
  const quotes = [
    { role: "primary" as const, quote: verdict.oracle.primary },
    ...verdict.oracle.supporting.map((quote) => ({ role: "supporting" as const, quote })),
  ].map(({ role, quote }) => ({
    role,
    hexagramNumber: quote.hexagramNumber,
    hexagramChineseName: quote.hexagramChineseName,
    label: quote.label,
    text: quote.text,
    sourceWork: quote.source.work,
    sourceUrl: quote.source.textSourceUrl,
  }));

  return {
    schemaVersion: "commercial-reading-v2",
    locale,
    readingVariant: facts.readingVariant,
    deterministic: {
      primaryHexagramNumber: verdict.primaryHexagram.number,
      relatingHexagramNumber: verdict.relatingHexagram?.number ?? null,
      nuclearHexagramNumber: verdict.nuclearHexagram.number,
      movingLinePositions: [...verdict.movingLinePositions],
      changeRuleId: verdict.changeRule.ruleId,
      direction: verdict.direction,
      tiYong: verdict.tiYong
        ? {
            tiTrigram: verdict.tiYong.ti.trigram,
            yongTrigram: verdict.tiYong.yong.trigram,
            relation: verdict.tiYong.relation,
          }
        : null,
      quotes,
    },
    generated,
    disclaimer: DISCLAIMER[locale],
  };
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

function snapshotForSession(input: {
  session: Row;
  castingId: string;
  generationEpoch: number;
  questionText: string;
  facts: DeterministicFacts;
}): string {
  return calculateDeepReadingInputSnapshotHash({
    castingId: input.castingId,
    userId: String(input.session.user_id),
    epoch: input.generationEpoch,
    question: input.questionText,
    scene: String(input.session.scene),
    interpretationGoal: String(input.session.interpretation_goal),
    facts: input.facts,
  });
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
  locale: ContentLocale;
}): Promise<{ leaseToken: string; providerInput: ReadingProviderInput; inputSnapshotHash: string }> {
  "use step";
  const sql = getPostgresClient();

  return sql.begin(async (transaction: TransactionSql) => {
    const session = await loadLockedSession(transaction, input.castingId);
    if (session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }
    if (session.lifecycle !== "revealed") throw new Error("CASTING_NOT_READY");
    if (session.risk_status !== "allowed") throw new Error("RISK_PROHIBITED");
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

    // Recompute before claiming and bind the workflow to the immutable hash
    // recorded when the entitlement was originally reserved.
    const questionText = decryptQuestionForGeneration(session);
    const facts = factsFromSession(session);
    const calculatedSnapshotHash = snapshotForSession({
      session,
      castingId: input.castingId,
      generationEpoch: input.generationEpoch,
      questionText,
      facts,
    });
    const storedSnapshotHash = String(job.input_snapshot_hash);
    if (!storedSnapshotHash || calculatedSnapshotHash !== storedSnapshotHash) {
      throw new Error("INPUT_SNAPSHOT_MISMATCH");
    }

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
        question: questionText,
        scene: session.scene,
        interpretationGoal: session.interpretation_goal,
        facts,
        verdict: verdictFromFacts(facts),
        locale: input.locale,
      },
      inputSnapshotHash: storedSnapshotHash,
    };
  });
}

export async function generateDeepReadingStep(input: {
  providerInput: ReadingProviderInput;
  jobId: string;
  leaseToken: string;
}): Promise<ProviderGenerationResult> {
  "use step";
  const sql = getPostgresClient();
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  const provider = await createAiSdkGenerationProvider();
  return provider.generateReading(input.providerInput, new AbortController().signal);
}

export async function reviewDeepReadingStep(input: {
  output: unknown;
  facts: DeterministicFacts;
  jobId: string;
  leaseToken: string;
}): Promise<OutputReviewDecision> {
  "use step";
  const sql = getPostgresClient();
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  const reviewer = await createAiSdkOutputReviewer();
  return reviewer.review(
    { kind: "deep_reading", output: input.output, facts: input.facts },
    new AbortController().signal,
  );
}

export async function finalizeDeepReadingStep(input: {
  castingId: string;
  jobId: string;
  reservationId: string;
  idempotencyKey: string;
  generationEpoch: number;
  inputSnapshotHash: string;
  leaseToken: string;
  locale: ContentLocale;
  generationResult: ProviderGenerationResult;
  reviewDecision: OutputReviewDecision;
}): Promise<{ success: boolean }> {
  "use step";
  const sql = getPostgresClient();
  if (input.reviewDecision.status !== "pass") throw new Error("OUTPUT_REVIEW_FAILED");

  return sql.begin(async (transaction: TransactionSql) => {
    const session = await loadLockedSession(transaction, input.castingId);
    if (session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }

    const questionText = decryptQuestionForGeneration(session);
    const facts = factsFromSession(session);
    const recomputedSnapshotHash = snapshotForSession({
      session,
      castingId: input.castingId,
      generationEpoch: input.generationEpoch,
      questionText,
      facts,
    });

    const jobRows = await transaction`
      select * from generation_jobs
      where id = ${input.jobId} and casting_id = ${input.castingId}
        and status = 'running' and lease_token = ${input.leaseToken}
        and lease_expires_at > clock_timestamp()
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
      || recomputedSnapshotHash !== storedSnapshotHash
    ) {
      throw new Error("INPUT_SNAPSHOT_MISMATCH");
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

    // The model returned only its application of the verdict. Rebuild the
    // verdict from the verified facts and check the generated half against it
    // mechanically before assembling the stored report.
    const verdict = verdictFromFacts(facts);
    const locale = input.locale;
    const validation = validateGeneratedReading(
      input.generationResult.output,
      verdict,
      questionText,
      locale,
    );
    if (!validation.valid) {
      throw new Error(`DEEP_READING_VALIDATION_FAILED: ${validation.failures.join(",")}`);
    }
    const generated = input.generationResult.output as GeneratedReading;
    const output = assembleReadingReport(verdict, generated, facts, locale);
    const config = getServerConfig();
    const model = config.aiModelDeepReading ?? "gemini-2.5-pro";
    const schemaVersion = "commercial-reading-v2";
    const promptVersion = "v2";
    const provider = "google";
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
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${input.jobId}, ${input.castingId}, 'deep_reading',
        ${input.reviewDecision.status}, ${JSON.stringify(input.reviewDecision.reasonCodes)}::jsonb,
        'reviewer-v1', ${String(input.reviewDecision.schemaValid)},
        ${String(input.reviewDecision.safetyPass)}, ${String(input.reviewDecision.factConsistencyPass)},
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
