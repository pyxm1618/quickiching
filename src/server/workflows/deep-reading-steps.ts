import { createHmac, randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { getPostgresClient } from "@/server/db/client";
import { deterministicFactsSchema, readingReportSchema, type DeterministicFacts, type CommercialReadingReport } from "@/domain/generation/schemas";
import { createAiSdkGenerationProvider, createAiSdkOutputReviewer } from "@/server/generation/ai-sdk-provider";
import { getServerConfig } from "@/server/config";
import type { OutputReviewDecision, ProviderGenerationResult, ProviderInput } from "@/server/generation/types";

type Row = Record<string, any>;

const LEASE_DURATION_MS = 5 * 60 * 1000;

export async function claimJobLeaseStep(input: {
  castingId: string;
  jobId: string;
  idempotencyKey: string;
  generationEpoch: number;
}): Promise<{
  leaseToken: string;
  providerInput: ProviderInput;
  inputSnapshotHash: string;
}> {
  "use step";
  const sql = getPostgresClient();

  return sql.begin(async (transaction: TransactionSql) => {
    // 1. Verify casting session is valid, active and not deleted
    const sessionRows = await transaction`
      select * from casting_sessions
      where id = ${input.castingId}
      limit 1
      for update
    ` as Row[];
    const session = sessionRows[0];
    if (!session || session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }

    // 2. Claim generation job
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

    const leaseToken = randomUUID();
    const attemptCount = Number(job.attempt_count) + 1;

    await transaction`
      update generation_jobs
      set status = 'running',
          lease_owner = 'workflow_worker',
          lease_token = ${leaseToken},
          lease_expires_at = clock_timestamp() + (${LEASE_DURATION_MS} * interval '1 millisecond'),
          attempt_count = ${attemptCount},
          updated_at = clock_timestamp()
      where id = ${input.jobId}
    `;

    // 3. Update workflow run to running
    await transaction`
      update workflow_runs
      set status = 'running',
          attempt_count = greatest(attempt_count, ${attemptCount}),
          updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;

    // 4. Fetch questions and cast results to construct snapshot
    const questionRows = await transaction`
      select * from question_versions
      where casting_id = ${input.castingId}
      order by version_number desc
      limit 1
    ` as Row[];
    const castRows = await transaction`
      select * from cast_results
      where casting_id = ${input.castingId}
      limit 1
    ` as Row[];
    const cast = castRows[0];
    if (!cast) throw new Error("CAST_RESULT_UNAVAILABLE");

    const lineValues = (cast.line_values as number[]) ?? [];
    const facts: DeterministicFacts = {
      method: session.method as any,
      algorithmVersion: String(cast.algorithm_version),
      classicMappingVersion: String(cast.classic_mapping_version),
      lineValuesBottomUp: [
        lineValues[0] as any,
        lineValues[1] as any,
        lineValues[2] as any,
        lineValues[3] as any,
        lineValues[4] as any,
        lineValues[5] as any,
      ],
      primaryHexagramNumber: Number(cast.primary_hexagram_number),
      movingLinePositions: (cast.moving_line_positions as number[]) ?? [],
      relatingHexagramNumber: cast.relating_hexagram_number ? Number(cast.relating_hexagram_number) : null,
      readingVariant: "standard",
    };

    const providerInput: ProviderInput = {
      castingId: input.castingId,
      question: "question-context-verified",
      scene: session.scene,
      interpretationGoal: session.interpretation_goal,
      facts,
    };

    return {
      leaseToken,
      providerInput,
      inputSnapshotHash: String(job.input_snapshot_hash),
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

  // Validate lease is still valid
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  const provider = await createAiSdkGenerationProvider();
  const abortController = new AbortController();
  return provider.generateReading(input.providerInput, abortController.signal);
}

export async function reviewDeepReadingStep(input: {
  output: unknown;
  facts: DeterministicFacts;
  jobId: string;
  leaseToken: string;
}): Promise<OutputReviewDecision> {
  "use step";
  const sql = getPostgresClient();

  // Validate lease
  const leaseRows = await sql`
    select lease_expires_at > clock_timestamp() as active
    from generation_jobs
    where id = ${input.jobId} and lease_token = ${input.leaseToken} and status = 'running'
  ` as Row[];
  if (!leaseRows[0]?.active) throw new Error("GENERATION_LEASE_EXPIRED");

  const reviewer = await createAiSdkOutputReviewer();
  const abortController = new AbortController();
  return reviewer.review({ kind: "deep_reading", output: input.output, facts: input.facts }, abortController.signal);
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

  if (input.reviewDecision.status !== "pass") {
    throw new Error("OUTPUT_REVIEW_FAILED");
  }

  return sql.begin(async (transaction: TransactionSql) => {
    // 1. Verify casting session is still active and epoch matches
    const sessionRows = await transaction`
      select * from casting_sessions
      where id = ${input.castingId}
      limit 1
      for update
    ` as Row[];
    const session = sessionRows[0];
    if (!session || session.deleted_at != null || Number(session.generation_epoch) !== input.generationEpoch) {
      throw new Error("CASTING_SESSION_INVALID_OR_DELETED");
    }

    // 2. Verify job ownership and lease
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

    // 3. Verify reservation is still reserved and matches user
    const resRows = await transaction`
      select * from entitlement_reservations
      where id = ${input.reservationId} and casting_id = ${input.castingId}
        and status = 'reserved'
      limit 1
      for update
    ` as Row[];
    const reservation = resRows[0];
    if (!reservation || String(reservation.user_id) !== String(session.user_id)) {
      throw new Error("ENTITLEMENT_RESERVATION_INVALID");
    }

    const output = input.generationResult.output as CommercialReadingReport;
    const config = getServerConfig();
    const model = config.aiModelDeepReading ?? "gemini-2.5-pro";
    const secret = config.appSecret ?? "default-secret-32-chars-long-min!";
    const integrityHash = createHmac("sha256", secret)
      .update(`${input.castingId}:${JSON.stringify(output)}`)
      .digest("hex");

    // 4. Insert output review
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

    // 5. Insert deep reading results
    await transaction`
      insert into deep_reading_results (
        casting_id, job_id, reservation_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, persisted_at
      ) values (
        ${input.castingId}, ${input.jobId}, ${input.reservationId},
        ${JSON.stringify(output)}::jsonb, 'commercial-reading-v1', 'v1',
        'google', ${model}, ${integrityHash}, clock_timestamp()
      )
    `;

    // 6. Consume reservation and entitlement batch
    await transaction`
      update entitlement_reservations
      set status = 'consumed', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.reservationId}
    `;

    await transaction`
      update entitlement_batches
      set quantity_reserved = greatest(0, quantity_reserved - 1),
          quantity_consumed = quantity_consumed + 1,
          updated_at = clock_timestamp()
      where id = ${String(reservation.batch_id)}
    `;

    await transaction`
      insert into entitlement_ledger (
        id, batch_id, order_id, action, quantity, business_key, created_at
      )
      select
        ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'consume', 1,
        ${`consume:${input.jobId}`}, clock_timestamp()
      from entitlement_batches b
      where b.id = ${String(reservation.batch_id)}
      on conflict (business_key) do nothing
    `;

    // 7. Complete job and workflow run
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

    return { success: true };
  });
}

export async function handleWorkflowFailureStep(input: {
  jobId: string;
  reservationId: string;
  idempotencyKey: string;
  errorCode: string;
}): Promise<void> {
  "use step";
  const sql = getPostgresClient();

  await sql.begin(async (transaction: TransactionSql) => {
    // Fail job
    await transaction`
      update generation_jobs
      set status = 'failed', structured_error_code = ${input.errorCode},
          lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
      where id = ${input.jobId} and status in ('queued', 'running')
    `;

    // Release reservation
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
            quantity_available = quantity_available + 1,
            updated_at = clock_timestamp()
        where id = ${String(reservation.batch_id)}
      `;

      await transaction`
        insert into entitlement_ledger (
          id, batch_id, order_id, action, quantity, business_key, created_at
        )
        select
          ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'release', 1,
          ${`release:${input.reservationId}`}, clock_timestamp()
        from entitlement_batches b
        where b.id = ${String(reservation.batch_id)}
        on conflict (business_key) do nothing
      `;
    }

    // Fail workflow run
    await transaction`
      update workflow_runs
      set status = 'failed', error_code = ${input.errorCode}, updated_at = clock_timestamp()
      where idempotency_key = ${input.idempotencyKey}
    `;
  });
}
