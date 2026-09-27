import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { WorkflowStarter } from "@/server/workflows/workflow-starter";
import { deterministicFactsSchema } from "@/domain/generation/schemas";
import {
  deepReadingContextEnrichmentSchema,
  deepReadingContextSnapshotSchema,
  type DeepReadingContextEnrichment,
  type DeepReadingContextSnapshot,
} from "@/domain/generation/deep-reading-contract";
import { evaluateRisk } from "@/domain/risk/engine";
import type { Scene } from "@/domain/casting/types";
import { buildDeepReadingKnowledgeBundle } from "./deep-reading-knowledge";
import {
  calculateDeepReadingContextSnapshotHash,
  verifyResultIntegrity,
} from "./integrity";
import {
  decryptDeepReadingContextSnapshot,
  encryptDeepReadingContextSnapshot,
} from "./deep-reading-snapshot";
import { decryptQuestionForGeneration } from "./question-crypto";

type Row = Record<string, any>;

export type DeepReadingRequestResult = {
  jobId: string;
  reservationId: string;
  status: "queued" | "running" | "completed";
  output?: unknown;
};

export type DeepReadingStatusResult = {
  status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
  output?: unknown;
  snapshot?: DeepReadingContextSnapshot;
  errorCode?: string;
};

export interface DeepReadingService {
  requestDeepReading(options: {
    userId: string;
    castingId: string;
    enrichment?: unknown;
  }): Promise<DeepReadingRequestResult>;

  getDeepReadingStatus(options: {
    userId: string;
    castingId: string;
  }): Promise<DeepReadingStatusResult>;
}

function readingVariant(movingLinePositions: number[]) {
  if (movingLinePositions.length === 0) return "still_hexagram" as const;
  if (movingLinePositions.length === 6) return "all_lines_moving" as const;
  if (movingLinePositions.length > 1) return "multiple_moving" as const;
  return "standard" as const;
}

function factsFromSession(session: Row) {
  const lineValues = session.line_values as number[] | null;
  const movingLinePositions = session.moving_line_positions as number[] | null;
  return deterministicFactsSchema.parse({
    method: session.method,
    algorithmVersion: String(session.algorithm_version ?? ""),
    classicMappingVersion: String(session.classic_mapping_version ?? ""),
    lineValuesBottomUp: lineValues,
    primaryHexagramNumber: Number(session.primary_hexagram_number),
    movingLinePositions,
    relatingHexagramNumber: session.relating_hexagram_number == null ? null : Number(session.relating_hexagram_number),
    readingVariant: readingVariant(movingLinePositions ?? []),
  });
}

function riskText(question: string, context: DeepReadingContextEnrichment): string {
  return [
    question,
    context.contextNotes,
    ...context.options,
    ...context.constraints,
    ...context.concerns,
  ].filter(Boolean).join("\n");
}

async function compensateWorkflowStartFailure(
  transaction: TransactionSql,
  input: {
    jobId: string;
    reservationId: string;
    idempotencyKey: string;
    castingId: string;
    userId: string;
    generationEpoch: number;
  },
): Promise<boolean> {
  const failedJobs = await transaction`
    update generation_jobs
    set status = 'failed', structured_error_code = 'WORKFLOW_START_FAILED',
        lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
    where id = ${input.jobId} and casting_id = ${input.castingId}
      and generation_epoch = ${input.generationEpoch} and status = 'queued'
    returning id
  ` as Row[];
  if (!failedJobs[0]) return false;

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
    update workflow_runs set status = 'failed', error_code = 'WORKFLOW_START_FAILED', updated_at = clock_timestamp()
    where idempotency_key = ${input.idempotencyKey}
  `;
  await transaction`
    insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
    values (
      ${randomUUID()}, 'generation', 'deep_reading_start_failed', 'job', ${input.jobId},
      ${input.userId}, ${JSON.stringify({ castingId: input.castingId, reservationId: input.reservationId, errorCode: "WORKFLOW_START_FAILED" })}::jsonb,
      clock_timestamp()
    )
  `;
  return true;
}

export function createDeepReadingService(dependencies: {
  sql: Sql;
  workflowStarter: WorkflowStarter;
  env?: Record<string, string | undefined>;
}): DeepReadingService {
  const { sql, workflowStarter } = dependencies;
  const env = dependencies.env ?? process.env;

  return {
    async requestDeepReading(options): Promise<DeepReadingRequestResult> {
      const { userId, castingId } = options;
      const submittedEnrichment = options.enrichment === undefined
        ? null
        : deepReadingContextEnrichmentSchema.safeParse(options.enrichment);
      if (submittedEnrichment && !submittedEnrichment.success) throw new Error("CONTEXT_INSUFFICIENT");

      const prepared = await sql.begin(async (transaction) => {
        const userRows = await transaction`select id from users where id = ${userId} limit 1` as Row[];
        if (!userRows[0]) throw new Error("USER_NOT_FOUND");

        const sessionRows = await transaction`
          select
            c.id, c.user_id, c.deleted_at, c.generation_epoch, c.lifecycle, c.risk_status,
            c.scene, c.interpretation_goal, c.method,
            q.id as question_version_id, q.ciphertext as question_ciphertext,
            q.iv as question_iv, q.auth_tag as question_auth_tag,
            q.encryption_key_version as question_encryption_key_version,
            r.line_values, r.primary_hexagram_number, r.moving_line_positions,
            r.relating_hexagram_number, r.algorithm_version, r.classic_mapping_version,
            r.result_hmac, r.result_hmac_key_version
          from casting_sessions c
          left join lateral (
            select * from question_versions where casting_id = c.id order by version_number desc limit 1
          ) q on true
          left join cast_results r on r.casting_id = c.id
          where c.id = ${castingId}
          limit 1 for update of c
        ` as Row[];
        const session = sessionRows[0];
        if (!session || String(session.user_id) !== userId || session.deleted_at != null) throw new Error("CASTING_NOT_FOUND");
        if (session.lifecycle !== "revealed") throw new Error("CASTING_NOT_READY");
        if (session.method !== "three_coin") throw new Error("UNSUPPORTED_CAST_METHOD");
        if (!session.result_hmac) throw new Error("CAST_RESULT_UNAVAILABLE");
        const currentFacts = factsFromSession(session);
        if (!verifyResultIntegrity({
          facts: currentFacts,
          resultHmac: String(session.result_hmac),
          resultHmacKeyVersion: String(session.result_hmac_key_version),
        }, env)) throw new Error("CAST_RESULT_INTEGRITY_INVALID");

        const resultRows = await transaction`
          select job_id, reservation_id, output from deep_reading_results where casting_id = ${castingId} limit 1
        ` as Row[];
        if (resultRows[0]) {
          return {
            alreadyCompleted: true as const,
            jobId: String(resultRows[0].job_id),
            reservationId: String(resultRows[0].reservation_id),
            output: resultRows[0].output,
          };
        }

        const activeJobRows = await transaction`
          select j.id as job_id, j.status as job_status, r.id as res_id
          from generation_jobs j
          left join entitlement_reservations r on r.job_id = j.id and r.status = 'reserved'
          where j.casting_id = ${castingId} and j.kind = 'deep_reading' and j.status in ('queued', 'running')
          limit 1
        ` as Row[];
        if (activeJobRows[0]) {
          return {
            alreadyActive: true as const,
            jobId: String(activeJobRows[0].job_id),
            reservationId: activeJobRows[0].res_id ? String(activeJobRows[0].res_id) : "",
            status: activeJobRows[0].job_status as "queued" | "running",
          };
        }

        const storedSnapshotRows = await transaction`
          select ciphertext, iv, auth_tag, encryption_key_version, snapshot_hash
          from deep_reading_context_snapshots where casting_id = ${castingId} limit 1
        ` as Row[];
        let snapshot: DeepReadingContextSnapshot;
        let snapshotHash: string;
        if (storedSnapshotRows[0]) {
          const row = storedSnapshotRows[0];
          snapshot = decryptDeepReadingContextSnapshot(castingId, {
            ciphertext: String(row.ciphertext),
            iv: String(row.iv),
            authTag: String(row.auth_tag),
            encryptionKeyVersion: String(row.encryption_key_version),
          }, env);
          snapshotHash = calculateDeepReadingContextSnapshotHash(snapshot, env);
          if (snapshotHash !== String(row.snapshot_hash)) throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
        } else {
          if (!submittedEnrichment?.success) throw new Error("CONTEXT_INSUFFICIENT");
          const coreQuestionAtCast = decryptQuestionForGeneration(session, env);
          const facts = currentFacts;
          const context = submittedEnrichment.data;
          const risk = evaluateRisk(riskText(coreQuestionAtCast, context), String(session.scene) as Scene);
          await transaction`
            update casting_sessions set risk_status = ${risk.status}, risk_rule_version = ${risk.ruleVersion}, updated_at = clock_timestamp()
            where id = ${castingId}
          `;
          if (risk.status !== "allowed") {
            return { blockedRisk: risk.status as string, reasonCode: risk.reasonCode };
          }

          const knowledge = await buildDeepReadingKnowledgeBundle(facts);
          snapshot = deepReadingContextSnapshotSchema.parse({
            schemaVersion: "deep-reading-context-v1",
            coreQuestionAtCast,
            context,
            scene: String(session.scene),
            castMethod: "three_coin",
            methodVersion: facts.algorithmVersion,
            facts,
            snapshotAt: new Date().toISOString(),
            knowledgeVersion: knowledge.version,
            risk: { status: "allowed", ruleVersion: risk.ruleVersion, reasonCode: risk.reasonCode },
            knowledge,
          });
          const encryptedSnapshot = encryptDeepReadingContextSnapshot(castingId, snapshot, env);
          snapshotHash = calculateDeepReadingContextSnapshotHash(snapshot, env);
          await transaction`
            insert into deep_reading_context_snapshots (
              casting_id, ciphertext, iv, auth_tag, encryption_key_version, snapshot_hash, created_at
            ) values (
              ${castingId}, ${encryptedSnapshot.ciphertext}, ${encryptedSnapshot.iv},
              ${encryptedSnapshot.authTag}, ${encryptedSnapshot.encryptionKeyVersion}, ${snapshotHash}, clock_timestamp()
            )
          `;
        }

        const refreshedRisk = evaluateRisk(
          [snapshot.coreQuestionAtCast, snapshot.context.contextNotes, ...snapshot.context.options,
            ...snapshot.context.constraints, ...snapshot.context.concerns].filter(Boolean).join("\n"),
          snapshot.scene as Scene,
        );
        await transaction`
          update casting_sessions set risk_status = ${refreshedRisk.status},
            risk_rule_version = ${refreshedRisk.ruleVersion}, updated_at = clock_timestamp()
          where id = ${castingId}
        `;
        if (refreshedRisk.status !== "allowed") {
          return { blockedRisk: refreshedRisk.status as string, reasonCode: refreshedRisk.reasonCode };
        }

        const batchRows = await transaction`
          select id, expires_at from entitlement_batches
          where user_id = ${userId} and quantity_available > 0 and expires_at > clock_timestamp()
          order by expires_at asc, created_at asc limit 1 for update
        ` as Row[];
        const batch = batchRows[0];
        if (!batch) throw new Error("INSUFFICIENT_CREDITS");

        const jobId = randomUUID();
        const reservationId = randomUUID();
        const initialLeaseToken = randomUUID();
        const epoch = Number(session.generation_epoch);
        const idempotencyKey = `deep:${castingId}:${epoch}:${jobId}`;

        await transaction`
          update entitlement_batches set quantity_available = quantity_available - 1,
            quantity_reserved = quantity_reserved + 1, updated_at = clock_timestamp()
          where id = ${String(batch.id)}
        `;
        await transaction`
          insert into generation_jobs (
            id, casting_id, kind, status, generation_epoch, idempotency_key,
            input_snapshot_hash, timeout_at, created_at, updated_at
          ) values (
            ${jobId}, ${castingId}, 'deep_reading', 'queued', ${epoch}, ${idempotencyKey},
            ${snapshotHash}, clock_timestamp() + interval '5 minutes', clock_timestamp(), clock_timestamp()
          )
        `;
        await transaction`
          insert into entitlement_reservations (
            id, batch_id, user_id, casting_id, job_id, status, lease_token,
            lease_expires_at, expires_at, created_at, updated_at
          ) values (
            ${reservationId}, ${String(batch.id)}, ${userId}, ${castingId}, ${jobId}, 'reserved',
            ${initialLeaseToken},
            least(${batch.expires_at}::timestamptz, clock_timestamp() + interval '5 minutes'),
            ${batch.expires_at}::timestamptz, clock_timestamp(), clock_timestamp()
          )
        `;
        await transaction`
          insert into entitlement_ledger (id, batch_id, order_id, action, quantity, business_key, created_at)
          select ${randomUUID()}, ${String(batch.id)}, b.order_id, 'reserve', 1,
                 ${`reserve:${reservationId}`}, clock_timestamp()
          from entitlement_batches b where b.id = ${String(batch.id)}
          on conflict (business_key) do nothing
        `;
        await transaction`
          insert into workflow_runs (id, workflow_name, idempotency_key, entity_type, entity_id, status, created_at, updated_at)
          values (${randomUUID()}, 'deep_reading', ${idempotencyKey}, 'casting', ${castingId}, 'start_pending', clock_timestamp(), clock_timestamp())
        `;
        await transaction`
          insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
          values (
            ${randomUUID()}, 'entitlement', 'credit_reserved', 'reservation', ${reservationId}, ${userId},
            ${JSON.stringify({ castingId, jobId, batchId: String(batch.id), snapshotHash })}::jsonb, clock_timestamp()
          )
        `;
        return { alreadyCompleted: false as const, alreadyActive: false as const, jobId, reservationId, idempotencyKey, epoch };
      });

      if ("blockedRisk" in prepared) {
        const blockedRisk = String(prepared.blockedRisk ?? "UNKNOWN");
        throw new Error(`RISK_${blockedRisk.toUpperCase()}`);
      }
      if (prepared.alreadyCompleted) {
        return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: "completed", output: prepared.output };
      }
      if (prepared.alreadyActive) {
        return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: prepared.status };
      }

      try {
        const started = await workflowStarter.startDeepReadingWorkflow({
          castingId,
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          idempotencyKey: prepared.idempotencyKey,
          generationEpoch: prepared.epoch,
        });
        if (!started.started) throw new Error("WORKFLOW_START_FAILED");
      } catch (error) {
        console.error("[REQUEST_DEEP_READING_WORKFLOW_ERROR]", error);
        await sql.begin((transaction) => compensateWorkflowStartFailure(transaction, {
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          idempotencyKey: prepared.idempotencyKey,
          castingId,
          userId,
          generationEpoch: prepared.epoch,
        }));
        throw new Error("WORKFLOW_START_FAILED");
      }
      return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: "queued" };
    },

    async getDeepReadingStatus(options): Promise<DeepReadingStatusResult> {
      const { userId, castingId } = options;
      const userRows = await sql`select id from users where id = ${userId} limit 1` as Row[];
      if (!userRows[0]) throw new Error("USER_NOT_FOUND");

      const sessionRows = await sql`
        select id, user_id, deleted_at from casting_sessions where id = ${castingId} limit 1
      ` as Row[];
      if (!sessionRows[0] || String(sessionRows[0].user_id) !== userId || sessionRows[0].deleted_at != null) {
        throw new Error("CASTING_NOT_FOUND");
      }

      const snapshotRows = await sql`
        select ciphertext, iv, auth_tag, encryption_key_version, snapshot_hash
        from deep_reading_context_snapshots where casting_id = ${castingId} limit 1
      ` as Row[];
      let snapshot: DeepReadingContextSnapshot | undefined;
      if (snapshotRows[0]) {
        const row = snapshotRows[0];
        snapshot = decryptDeepReadingContextSnapshot(castingId, {
          ciphertext: String(row.ciphertext),
          iv: String(row.iv),
          authTag: String(row.auth_tag),
          encryptionKeyVersion: String(row.encryption_key_version),
        }, env);
        if (calculateDeepReadingContextSnapshotHash(snapshot, env) !== String(row.snapshot_hash)) {
          throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
        }
      }

      const resultRows = await sql`select output from deep_reading_results where casting_id = ${castingId} limit 1` as Row[];
      if (resultRows[0]) return { status: "completed", output: resultRows[0].output, snapshot };

      const jobRows = await sql`
        select status, structured_error_code from generation_jobs
        where casting_id = ${castingId} and kind = 'deep_reading' order by created_at desc limit 1
      ` as Row[];
      if (!jobRows[0]) return { status: "not_started", snapshot };
      return {
        status: jobRows[0].status as DeepReadingStatusResult["status"],
        snapshot,
        errorCode: jobRows[0].structured_error_code ? String(jobRows[0].structured_error_code) : undefined,
      };
    },
  };
}
