import postgres from "postgres";
import { writeFile } from "node:fs/promises";
import { requireProductionDatabaseUrl } from "../src/server/readiness/production-schema-release";

// One-off read-only evidence collection. Never reads questions, reports, auth
// tokens, provider credentials, or checkout URLs, and never changes balances.
const sql = postgres(requireProductionDatabaseUrl(process.env.PRODUCTION_DATABASE_URL), { max: 1, prepare: false });
const report: Record<string, unknown> = { capturedAt: new Date().toISOString(), databaseAccess: "read-only" };
try {
  await sql.begin("read only", async (tx) => {
    await tx`set local statement_timeout = '15s'`;
    report.counts = await tx`select
      (select count(*) from users) as users,
      (select count(*) from payment_orders) as orders,
      (select count(*) from casting_sessions) as casts,
      (select count(*) from generation_jobs) as generation_jobs,
      (select count(*) from deep_reading_context_snapshots) as snapshots,
      (select count(*) from deep_reading_results) as delivered_reports`;
    report.orders = await tx`select provider_environment, status, count(*) as count,
      min(created_at) as first_created, max(created_at) as last_created,
      count(*) filter(where provider_payment_id is not null) as with_provider_payment,
      count(*) filter(where paid_at is not null) as with_paid_timestamp
      from payment_orders group by provider_environment, status order by provider_environment, status`;
    report.accountBalances = await tx`select
      left(u.email, 3) || '***@' || split_part(u.email, '@', 2) as masked_email,
      count(distinct o.id) as orders,
      coalesce(sum(b.quantity_available) filter(where b.expires_at > now()),0) as available,
      coalesce(sum(b.quantity_reserved),0) as reserved,
      coalesce(sum(b.quantity_consumed),0) as consumed,
      coalesce(sum(b.quantity_revoked),0) as revoked
      from users u left join payment_orders o on o.user_id = u.id
      left join entitlement_batches b on b.order_id = o.id
      group by u.id, u.email order by u.created_at desc limit 30`;
    report.generations = await tx`select j.id, j.casting_id, j.status, j.created_at,
      j.completed_at, j.structured_error_code, j.model_identifier,
      j.provider_request_identifier is not null as provider_request_recorded,
      s.casting_id is not null as immutable_snapshot_present,
      r.status as reservation_status, v.status as review_status,
      v.reason_codes as review_reason_codes, v.reviewer_model_version,
      v.question_relevance_pass, v.context_fidelity_pass, v.evidence_grounding_pass,
      d.casting_id is not null as report_delivered, d.provider, d.model,
      (select count(*) from entitlement_ledger l where l.business_key = 'consume:' || j.id::text) as consume_entries,
      (select count(*) from entitlement_ledger l where l.business_key = 'release:' || r.id::text) as release_entries
      from generation_jobs j
      left join deep_reading_context_snapshots s on s.casting_id = j.casting_id
      left join entitlement_reservations r on r.job_id = j.id
      left join generation_output_reviews v on v.job_id = j.id
      left join deep_reading_results d on d.job_id = j.id
      where j.kind = 'deep_reading' order by j.created_at desc limit 30`;
    report.testCast = await tx`select c.id, c.lifecycle, c.risk_status,
      r.primary_hexagram_number, r.moving_line_positions, r.relating_hexagram_number,
      q.ciphertext is not null as encrypted_question_present,
      l.winning_casting_id, l.locked_until,
      extract(epoch from (l.locked_until-l.created_at))/3600 as lock_hours,
      (select count(*) from generation_jobs j where j.casting_id=c.id) as jobs,
      (select count(*) from entitlement_reservations e where e.casting_id=c.id) as reservations
      from casting_sessions c join cast_results r on r.casting_id=c.id
      left join question_versions q on q.casting_id=c.id
      left join question_locks l on l.winning_casting_id=c.id
      where c.id = 'b149df4c-9801-4654-8e41-a3094a632e19'::uuid`;
    report.invariants = await tx`select
      (select count(*) from entitlement_batches where quantity_available + quantity_reserved + quantity_consumed + quantity_revoked <> quantity_total) as inconsistent_batches,
      (select count(*) from entitlement_reservations r join generation_jobs j on j.id=r.job_id where r.status='reserved' and j.status in ('failed','timed_out','dead_letter')) as failed_jobs_with_reserved_credit,
      (select count(*) from deep_reading_results d join entitlement_reservations r on r.id=d.reservation_id where r.status<>'consumed') as delivered_without_consumption`;
  });
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN_UNAVAILABLE");
  const projectResponse = await fetch("https://api.vercel.com/v9/projects/prj_pCpeoAys2GOqKZvkbLugYjpJWZBS?teamId=team_z1b9TTQtbNkr43dzs5JVJPnQ", { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
  if (!projectResponse.ok) throw new Error(`VERCEL_PROJECT_HTTP_${projectResponse.status}`);
  const project = await projectResponse.json();
  const deployment = project.targets?.production;
  report.production = { project: project.name, deploymentId: deployment?.id, sha: deployment?.meta?.githubCommitSha, state: deployment?.readyState, aliases: deployment?.alias };
  await writeFile("production-closeout-evidence.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error("PRODUCTION_EVIDENCE_COLLECTION_FAILED", error instanceof Error ? error.name : "unknown");
  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
