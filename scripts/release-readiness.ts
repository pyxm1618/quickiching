import { loadRuntimeConfig } from "../src/server/config";
import { createPostgresPersistence } from "../src/server/repositories/postgres";

const REQUIRED_MIGRATIONS = [
  "0000_v2_1",
  "0001_auth_payment",
  "0002_generation_runtime",
  "0003_production_composition",
] as const;

async function main() {
  const config = loadRuntimeConfig(process.env);
  if (config.mode !== "production") {
    throw new Error("RELEASE_CHECK_REQUIRES_PRODUCTION_RUNTIME_MODE");
  }
  if (
    config.ai !== "ai-sdk"
    || config.auth !== "better-auth"
    || config.payment !== "creem"
    || config.database !== "postgres"
    || config.workflow !== "vercel"
  ) {
    throw new Error("RELEASE_CHECK_ADAPTER_MISMATCH");
  }

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const migrationRows = await persistence.sql`
      select id from _app_migrations
      where id in ${persistence.sql(REQUIRED_MIGRATIONS)}
      order by id
    `;
    const applied = new Set(migrationRows.map((row) => String(row.id)));
    const missing = REQUIRED_MIGRATIONS.filter((id) => !applied.has(id));
    if (missing.length > 0) throw new Error(`RELEASE_CHECK_MIGRATIONS_MISSING:${missing.join(",")}`);

    const [database] = await persistence.sql`select current_database() as database, now() as checked_at`;
    const [runtime] = await persistence.sql`
      select
        count(*) filter (where status = 'running' and timeout_at <= now())::int as timed_out_jobs,
        count(*) filter (where status = 'queued' and available_at <= now())::int as ready_jobs
      from generation_jobs
    `;
    const [outbox] = await persistence.sql`
      select count(*) filter (
        where topic = 'generation.requested' and dispatched_at is null and available_at <= now()
      )::int as ready_messages
      from outbox
    `;

    console.log(JSON.stringify({
      status: "ready",
      database: database?.database,
      checkedAt: database?.checked_at,
      migrations: REQUIRED_MIGRATIONS,
      adapters: {
        ai: config.ai,
        auth: config.auth,
        payment: config.payment,
        database: config.database,
        workflow: config.workflow,
      },
      operationalBacklog: {
        timedOutJobs: Number(runtime?.timed_out_jobs ?? 0),
        readyJobs: Number(runtime?.ready_jobs ?? 0),
        readyOutboxMessages: Number(outbox?.ready_messages ?? 0),
      },
      externalSmokeTestsRequired: ["google-oauth", "magic-link-email", "turnstile", "creem-checkout-webhook", "ai-gateway"],
    }));
  } finally {
    await persistence.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "RELEASE_CHECK_FAILED");
  process.exitCode = 1;
});
