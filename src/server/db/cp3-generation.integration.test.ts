import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const databaseURL = process.env.TEST_DATABASE_URL;
if (!databaseURL) throw new Error("TEST_DATABASE_URL is required for PostgreSQL integration tests");

const sql = postgres(databaseURL, { max: 8, prepare: false });
const db = drizzle(sql);

describe("CP3 PostgreSQL generation core", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("installs the CP2 schema and all CP3 repair migrations safely", async () => {
    const migrations = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    expect(Number(migrations[0]?.count)).toBe(11);

    await migrate(db, { migrationsFolder: "drizzle" });
    const repeated = await sql<{ count: string }[]>`
      select count(*)::text as count from drizzle.__drizzle_migrations
    `;
    expect(Number(repeated[0]?.count)).toBe(11);
  });

  it("creates every CP3 persistence boundary without a plaintext question column", async () => {
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'casting_sessions', 'question_versions', 'cast_results', 'generation_jobs',
          'generation_attempts', 'preview_results', 'generation_output_reviews'
        )
      order by table_name
    `;
    expect(tables.map((row) => row.table_name)).toEqual([
      "cast_results",
      "casting_sessions",
      "generation_attempts",
      "generation_jobs",
      "generation_output_reviews",
      "preview_results",
      "question_versions",
    ]);

    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and table_name in ('question_versions', 'generation_jobs', 'preview_results')
      order by table_name, ordinal_position
    `;
    expect(columns.map((row) => `${row.table_name}.${row.column_name}`)).not.toEqual(
      expect.arrayContaining(["question_versions.question", "question_versions.context", "generation_jobs.snapshot"]),
    );
    expect(columns.map((row) => `${row.table_name}.${row.column_name}`)).toEqual(expect.arrayContaining([
      "question_versions.ciphertext",
      "question_versions.iv",
      "question_versions.auth_tag",
      "question_versions.fingerprint",
      "generation_jobs.input_snapshot_hash",
      "generation_jobs.lease_token",
      "generation_jobs.token_usage",
      "preview_results.output",
      "preview_results.integrity_hash",
    ]));
  });

  it("enforces idempotency, active-job, attempt, ownership, and immutable-result constraints", async () => {
    const suffix = randomUUID();
    const userId = `cp3-user-${suffix}`;
    const castingId = randomUUID();
    const wrongCastingId = randomUUID();
    const jobId = randomUUID();
    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP3 Integration', ${`${suffix}@example.com`}, true, ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, generation_epoch, created_at, updated_at
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'risk-v2',
        'career', 'what_do_i_need_to_see_clearly', 1, ${now}, ${now}
      )
    `;
    await sql`
      insert into question_versions (
        id, casting_id, version_number, ciphertext, iv, auth_tag,
        encryption_key_version, fingerprint_key_version, fingerprint, created_reason, created_at
      ) values (
        ${randomUUID()}, ${castingId}, 1, 'ciphertext', 'iv', 'tag', 'v1', 'v1', 'fingerprint', 'initial', ${now}
      )
    `;
    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, algorithm_version,
        classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${castingId}, ${[7, 9, 8, 7, 6, 7]}, 1, ${[2, 5]}, 44, ${JSON.stringify({ kind: "test" })},
        'three-coin-v1', 'king-wen-v1', 'hmac', 'v1', ${now}
      )
    `;
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        ${jobId}, ${castingId}, 'preview', 'queued', 1, ${`request-${suffix}`},
        'snapshot-hash', ${new Date(Date.parse(now) + 10_000).toISOString()}, ${now}, ${now}
      )
    `;

    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, generation_epoch, created_at, updated_at
      ) values (
        ${wrongCastingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'risk-v2',
        'career', 'what_do_i_need_to_see_clearly', 1, ${now}, ${now}
      )
    `;

    await expect(sql`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes,
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${jobId}, ${wrongCastingId}, 'preview', 'pass', ${JSON.stringify([])},
        'reviewer-v1', 'true', 'true', 'true', ${now}
      )
    `).rejects.toThrow();

    await expect(sql`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes,
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${jobId}, ${castingId}, 'deep_reading', 'pass', ${JSON.stringify([])},
        'reviewer-v1', 'true', 'true', 'true', ${now}
      )
    `).rejects.toThrow();

    await expect(sql`
      insert into generation_output_reviews (
        id, job_id, casting_id, kind, status, reason_codes,
        reviewer_model_version, schema_valid, safety_pass, fact_consistency_pass, created_at
      ) values (
        ${randomUUID()}, ${jobId}, ${castingId}, 'preview', 'pass', ${JSON.stringify([])},
        'reviewer-v1', 'false', 'true', 'true', ${now}
      )
    `).rejects.toThrow();

    await expect(sql`
      insert into preview_results (
        casting_id, job_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, persisted_at
      ) values (
        ${wrongCastingId}, ${jobId}, ${sql.json({ schemaVersion: "commercial-preview-v1" })},
        'commercial-preview-v1', 'commercial-preview-prompt-v1', 'fake', 'fake', 'hash', ${now}
      )
    `).rejects.toThrow();

    await expect(sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        ${randomUUID()}, ${castingId}, 'preview', 'queued', 1, ${`request-${suffix}-other`},
        'snapshot-hash-2', ${new Date(Date.parse(now) + 10_000).toISOString()}, ${now}, ${now}
      )
    `).rejects.toThrow();

    await sql`
      insert into generation_attempts (id, job_id, attempt_number, retry_classification, started_at)
      values (${randomUUID()}, ${jobId}, 1, 'timeout', ${now})
    `;
    await expect(sql`
      insert into generation_attempts (id, job_id, attempt_number, retry_classification, started_at)
      values (${randomUUID()}, ${jobId}, 1, 'timeout', ${now})
    `).rejects.toThrow();

    await expect(sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, generation_epoch, created_at, updated_at
      ) values (
        ${randomUUID()}, 'missing-user', 'three_coin', 'revealed', 'allowed', 'risk-v2',
        'career', 'what_do_i_need_to_see_clearly', 1, ${now}, ${now}
      )
    `).rejects.toThrow();

    await sql`
      insert into cast_results (
        casting_id, line_values, primary_hexagram_number, moving_line_positions,
        relating_hexagram_number, method_calculation, algorithm_version,
        classic_mapping_version, result_hmac, result_hmac_key_version, created_at
      ) values (
        ${castingId}, ${[7, 9, 8, 7, 6, 7]}, 1, ${[2, 5]}, 44, ${JSON.stringify({ kind: "replacement" })},
        'three-coin-v1', 'king-wen-v1', 'hmac-2', 'v1', ${now}
      )
    `.catch(() => undefined);
    await expect(sql`
      update cast_results set result_hmac = 'overwrite-attempt' where casting_id = ${castingId}
    `).rejects.toThrow();

    await sql`delete from casting_sessions where id in (${castingId}, ${wrongCastingId})`;
    const deletedChildren = await sql<{ count: string }[]>`
      select (
        (select count(*) from question_versions where casting_id = ${castingId})
        + (select count(*) from cast_results where casting_id = ${castingId})
        + (select count(*) from generation_jobs where casting_id = ${castingId})
      )::text as count
    `;
    expect(deletedChildren[0]?.count).toBe("0");
  });

  it("does not allow a preview row to exist without a completed reviewed job", async () => {
    const suffix = randomUUID();
    const userId = `cp3-preview-${suffix}`;
    const castingId = randomUUID();
    const jobId = randomUUID();
    const now = new Date().toISOString();
    await sql`
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values (${userId}, 'CP3 Preview', ${`${suffix}@example.com`}, true, ${now}, ${now})
    `;
    await sql`
      insert into casting_sessions (
        id, user_id, method, lifecycle, risk_status, risk_rule_version, scene,
        interpretation_goal, generation_epoch, created_at, updated_at
      ) values (
        ${castingId}, ${userId}, 'three_coin', 'revealed', 'allowed', 'risk-v2',
        'career', 'what_do_i_need_to_see_clearly', 0, ${now}, ${now}
      )
    `;
    await sql`
      insert into generation_jobs (
        id, casting_id, kind, status, generation_epoch, idempotency_key,
        input_snapshot_hash, timeout_at, created_at, updated_at
      ) values (
        ${jobId}, ${castingId}, 'preview', 'queued', 0, ${`preview-${suffix}`},
        'snapshot-hash', ${new Date(Date.parse(now) + 10_000).toISOString()}, ${now}, ${now}
      )
    `;
    await expect(sql`
      insert into preview_results (
        casting_id, job_id, output, schema_version, prompt_version,
        provider, model, integrity_hash, persisted_at
      ) values (
        ${castingId}, ${jobId}, ${sql.json({ schemaVersion: "commercial-preview-v1" })},
        'commercial-preview-v1', 'commercial-preview-prompt-v1', 'fake', 'fake', 'hash', ${now}
      )
    `).rejects.toThrow();
  });
});
