import { randomUUID } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import type { WorkflowStarter } from "@/server/workflows/workflow-starter";
import { deterministicFactsSchema } from "@/domain/generation/schemas";
import {
  deepReadingRequestSchema,
  activeDeepReadingContextSnapshotSchema,
  type ActiveDeepReadingContextSnapshot,
  type DeepReadingContextSnapshot,
} from "@/domain/generation/deep-reading-contract";
import { evaluateRisk } from "@/domain/risk/engine";
import { normalizeScene } from "@/domain/casting/types";
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

const DEEP_READING_WRITE_WINDOW_SECONDS = 60;
const DEEP_READING_WRITES_PER_WINDOW = 8;

export type DeepReadingRequestResult = {
  jobId: string;
  reservationId: string;
  status: "queued" | "running" | "completed" | "timed_out";
  output?: unknown;
  snapshot?: DeepReadingContextSnapshot;
  creditReservationCreated: boolean;
};

export type DeepReadingStatusResult = {
  status: "not_started" | "queued" | "running" | "completed" | "failed" | "timed_out";
  output?: unknown;
  snapshot?: DeepReadingContextSnapshot;
  errorCode?: string;
  availableCredits?: number;
};

export interface DeepReadingService {
  requestDeepReading(options: {
    userId: string;
    castingId: string;
    locale?: "en" | "zh-Hans";
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

async function reconcileExpiredDeepReading(
  transaction: TransactionSql,
  input: { castingId: string; userId: string },
): Promise<{ jobId: string; reservationId: string } | null> {
  const expiredRows = await transaction`
    select j.id as job_id, j.idempotency_key, r.id as reservation_id
    from generation_jobs j
    left join entitlement_reservations r on r.job_id = j.id
    where j.casting_id = ${input.castingId}
      and j.kind = 'deep_reading'
      and j.status in ('queued', 'running')
      and j.timeout_at <= clock_timestamp()
    order by j.created_at desc
    limit 1
    for update of j
  ` as Row[];
  const expired = expiredRows[0];
  if (!expired) return null;

  const timedOutRows = await transaction`
    update generation_jobs
    set status = 'timed_out',
        lease_owner = null,
        lease_token = null,
        lease_expires_at = null,
        structured_error_code = 'GENERATION_TIMEOUT',
        updated_at = clock_timestamp()
    where id = ${String(expired.job_id)}
      and status in ('queued', 'running')
      and timeout_at <= clock_timestamp()
    returning id
  ` as Row[];
  if (!timedOutRows[0]) return null;

  let reservationId = expired.reservation_id ? String(expired.reservation_id) : "";
  if (reservationId) {
    const reservationRows = await transaction`
      select id, batch_id
      from entitlement_reservations
      where id = ${reservationId}
        and job_id = ${String(expired.job_id)}
        and status = 'reserved'
      limit 1
      for update
    ` as Row[];
    const reservation = reservationRows[0];
    if (reservation) {
      const releasedRows = await transaction`
        update entitlement_reservations
        set status = 'released', lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
        where id = ${reservationId} and status = 'reserved'
        returning id
      ` as Row[];
      if (releasedRows[0]) {
        await transaction`
          update entitlement_batches
          set quantity_reserved = greatest(0, quantity_reserved - 1),
              quantity_available = quantity_available + 1,
              updated_at = clock_timestamp()
          where id = ${String(reservation.batch_id)}
        `;
        await transaction`
          insert into entitlement_ledger (id, batch_id, order_id, action, quantity, business_key, created_at)
          select ${randomUUID()}, ${String(reservation.batch_id)}, b.order_id, 'release', 1,
                 ${`release:${reservationId}`}, clock_timestamp()
          from entitlement_batches b where b.id = ${String(reservation.batch_id)}
          on conflict (business_key) do nothing
        `;
      }
    }
  }

  await transaction`
    update workflow_runs
    set status = 'failed', error_code = 'GENERATION_TIMEOUT', updated_at = clock_timestamp()
    where idempotency_key = ${String(expired.idempotency_key)}
      and status in ('start_pending', 'pending', 'running')
  `;
  await transaction`
    insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
    values (
      ${randomUUID()}, 'generation', 'deep_reading_timed_out', 'job', ${String(expired.job_id)}, ${input.userId},
      ${JSON.stringify({ castingId: input.castingId, reservationId, errorCode: "GENERATION_TIMEOUT" })}::jsonb,
      clock_timestamp()
    )
  `;

  return { jobId: String(expired.job_id), reservationId };
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
    legacyReadOnly?: boolean;
  },
): Promise<boolean> {
  const failedJobs = await transaction`
    update generation_jobs
    set status = 'failed', structured_error_code = ${input.legacyReadOnly ? 'LEGACY_DEEP_READING_READ_ONLY' : 'WORKFLOW_START_FAILED'},
        lease_token = null, lease_expires_at = null, updated_at = clock_timestamp()
    where id = ${input.jobId} and casting_id = ${input.castingId}
      and generation_epoch = ${input.generationEpoch}
      and (status = 'queued' or (${input.legacyReadOnly ?? false} and status = 'running'))
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
    update workflow_runs set status = 'failed', error_code = ${input.legacyReadOnly ? 'LEGACY_DEEP_READING_READ_ONLY' : 'WORKFLOW_START_FAILED'}, updated_at = clock_timestamp()
    where idempotency_key = ${input.idempotencyKey}
  `;
  await transaction`
    insert into audit_events (id, category, action, entity_type, entity_id, user_id, payload, created_at)
    values (
      ${randomUUID()}, 'generation', 'deep_reading_start_failed', 'job', ${input.jobId},
      ${input.userId}, ${JSON.stringify({ castingId: input.castingId, reservationId: input.reservationId, errorCode: input.legacyReadOnly ? "LEGACY_DEEP_READING_READ_ONLY" : "WORKFLOW_START_FAILED" })}::jsonb,
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

  async function loadAvailableCredits(userId: string): Promise<number> {
    const rows = await sql`
      select coalesce(sum(quantity_available), 0)::integer as available
      from entitlement_batches
      where user_id = ${userId} and expires_at > clock_timestamp()
    ` as Array<{ available: number }>;
    return Number(rows[0]?.available ?? 0);
  }

  return {
    async requestDeepReading(options): Promise<DeepReadingRequestResult> {
      const { userId, castingId } = options;
      const request = deepReadingRequestSchema.parse({ locale: options.locale });

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
          const snapshotRows = await transaction`
            select ciphertext, iv, auth_tag, encryption_key_version, snapshot_hash
            from deep_reading_context_snapshots where casting_id = ${castingId} limit 1
          ` as Row[];
          let completedSnapshot: DeepReadingContextSnapshot | undefined;
          if (snapshotRows[0]) {
            const row = snapshotRows[0];
            completedSnapshot = decryptDeepReadingContextSnapshot(castingId, {
              ciphertext: String(row.ciphertext),
              iv: String(row.iv),
              authTag: String(row.auth_tag),
              encryptionKeyVersion: String(row.encryption_key_version),
            }, env);
            if (calculateDeepReadingContextSnapshotHash(completedSnapshot, env) !== String(row.snapshot_hash)) {
              throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
            }
          }
          return {
            alreadyCompleted: true as const,
            jobId: String(resultRows[0].job_id),
            reservationId: String(resultRows[0].reservation_id),
            output: resultRows[0].output,
            snapshot: completedSnapshot,
          };
        }

        const timedOut = await reconcileExpiredDeepReading(transaction, { castingId, userId });
        if (timedOut) {
          return {
            alreadyCompleted: false as const,
            alreadyActive: false as const,
            timedOut: true as const,
            jobId: timedOut.jobId,
            reservationId: timedOut.reservationId,
          };
        }

        const activeJobRows = await transaction`
          select j.id as job_id, j.status as job_status, j.idempotency_key, r.id as res_id
          from generation_jobs j
          left join entitlement_reservations r on r.job_id = j.id and r.status = 'reserved'
          where j.casting_id = ${castingId} and j.kind = 'deep_reading' and j.status in ('queued', 'running')
          limit 1
        ` as Row[];
        if (activeJobRows[0]) {
          const rows = await transaction`
            select ciphertext, iv, auth_tag, encryption_key_version
            from deep_reading_context_snapshots where casting_id = ${castingId} limit 1
          ` as Row[];
          if (rows[0]) {
            const row = rows[0];
            const stored = decryptDeepReadingContextSnapshot(castingId, {
              ciphertext: String(row.ciphertext), iv: String(row.iv), authTag: String(row.auth_tag),
              encryptionKeyVersion: String(row.encryption_key_version),
            }, env);
            if (stored.schemaVersion !== "deep-reading-context-v2") {
              const active = activeJobRows[0];
              await compensateWorkflowStartFailure(transaction, {
                jobId: String(active.job_id), reservationId: String(active.res_id ?? ""),
                idempotencyKey: String(active.idempotency_key), castingId, userId,
                generationEpoch: Number(session.generation_epoch), legacyReadOnly: true,
              });
              return { legacyReadOnly: true as const };
            }
          }
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
        let snapshot: ActiveDeepReadingContextSnapshot;
        let snapshotHash: string;
        if (storedSnapshotRows[0]) {
          const row = storedSnapshotRows[0];
          const storedSnapshot = decryptDeepReadingContextSnapshot(castingId, {
            ciphertext: String(row.ciphertext),
            iv: String(row.iv),
            authTag: String(row.auth_tag),
            encryptionKeyVersion: String(row.encryption_key_version),
          }, env);
          if (storedSnapshot.schemaVersion !== "deep-reading-context-v2") throw new Error("LEGACY_DEEP_READING_READ_ONLY");
          snapshot = storedSnapshot;
          snapshotHash = calculateDeepReadingContextSnapshotHash(snapshot, env);
          if (snapshotHash !== String(row.snapshot_hash)) throw new Error("DEEP_READING_SNAPSHOT_INTEGRITY_INVALID");
        } else {
          const coreQuestionAtCast = decryptQuestionForGeneration(session, env);
          const facts = currentFacts;
          const normalizedScene = normalizeScene(String(session.scene));
          if (!normalizedScene) throw new Error("CASTING_SCENE_INVALID");
          const risk = evaluateRisk(coreQuestionAtCast);
          await transaction`
            update casting_sessions set risk_status = ${risk.status}, risk_rule_version = ${risk.ruleVersion}, updated_at = clock_timestamp()
            where id = ${castingId}
          `;
          if (risk.status !== "allowed") {
            return { blockedRisk: risk.status as string, reasonCode: risk.reasonCode };
          }

          const knowledge = await buildDeepReadingKnowledgeBundle(facts);
          snapshot = activeDeepReadingContextSnapshotSchema.parse({
            schemaVersion: "deep-reading-context-v2",
            coreQuestionAtCast,
            locale: request.locale,
            scene: normalizedScene,
            castMethod: facts.method,
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

        const refreshedRisk = evaluateRisk(snapshot.coreQuestionAtCast);
        await transaction`
          update casting_sessions set risk_status = ${refreshedRisk.status},
            risk_rule_version = ${refreshedRisk.ruleVersion}, updated_at = clock_timestamp()
          where id = ${castingId}
        `;
        if (refreshedRisk.status !== "allowed") {
          return { blockedRisk: refreshedRisk.status as string, reasonCode: refreshedRisk.reasonCode };
        }

        const recentWriteRows = await transaction<{ count: number }[]>`
          select count(*)::integer as count
          from generation_jobs j
          join casting_sessions c on c.id = j.casting_id
          where c.user_id = ${userId}
            and j.kind = 'deep_reading'
            and j.created_at >= clock_timestamp() - (${DEEP_READING_WRITE_WINDOW_SECONDS} * interval '1 second')
        `;
        if (Number(recentWriteRows[0]?.count ?? 0) >= DEEP_READING_WRITES_PER_WINDOW) {
          throw new Error("DEEP_READING_RATE_LIMITED");
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

      if ("legacyReadOnly" in prepared) throw new Error("LEGACY_DEEP_READING_READ_ONLY");
      if ("blockedRisk" in prepared) {
        const blockedRisk = String(prepared.blockedRisk ?? "UNKNOWN");
        throw new Error(`RISK_${blockedRisk.toUpperCase()}`);
      }
      if (prepared.alreadyCompleted) {
        return {
          jobId: prepared.jobId,
          reservationId: prepared.reservationId,
          status: "completed",
          output: prepared.output,
          snapshot: prepared.snapshot,
          creditReservationCreated: false,
        };
      }
      if ("timedOut" in prepared && prepared.timedOut) {
        return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: "timed_out", creditReservationCreated: false };
      }
      if (prepared.alreadyActive) {
        return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: prepared.status, creditReservationCreated: false };
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
      return { jobId: prepared.jobId, reservationId: prepared.reservationId, status: "queued", creditReservationCreated: true };
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

      const resultRows = await sql`select output from deep_reading_results where casting_id = ${castingId} limit 1` as Row[];
      if (resultRows[0]) {
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
        return { status: "completed", output: resultRows[0].output, snapshot, availableCredits: await loadAvailableCredits(userId) };
      }

      const timedOut = await sql.begin((transaction) =>
        reconcileExpiredDeepReading(transaction, { castingId, userId }),
      );
      if (timedOut) {
        return {
          status: "timed_out",
          errorCode: "GENERATION_TIMEOUT",
          availableCredits: await loadAvailableCredits(userId),
        };
      }

      const jobRows = await sql`
        select status, structured_error_code from generation_jobs
        where casting_id = ${castingId} and kind = 'deep_reading'
        order by created_at desc limit 1
      ` as Row[];
      const job = jobRows[0];
      if (!job) return { status: "not_started" };

      const status = String(job.status) as DeepReadingStatusResult["status"];
      if (status === "queued" || status === "running") {
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
        return { status, snapshot };
      }
      if (status === "failed" || status === "timed_out") {
        return {
          status,
          errorCode: job.structured_error_code ? String(job.structured_error_code) : undefined,
          availableCredits: await loadAvailableCredits(userId),
        };
      }
      return {
        status,
        errorCode: job.structured_error_code ? String(job.structured_error_code) : undefined,
      };
    },
  };
}
