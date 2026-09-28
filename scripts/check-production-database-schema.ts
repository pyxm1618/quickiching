import { requireProductionDatabaseUrl } from "../src/server/readiness/production-schema-release";
import { checkSystemReadiness } from "../src/server/readiness/readiness-service";

async function main(): Promise<void> {
  const databaseUrl = requireProductionDatabaseUrl(process.env.PRODUCTION_DATABASE_URL);
  const report = await checkSystemReadiness({
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "production",
  });

  console.log(JSON.stringify({
    database: report.database,
  }, null, 2));

  if (report.database.status !== "ok" || !report.database.connected || !report.database.migrationsChecked) {
    throw new Error(`CANDIDATE_PRODUCTION_SCHEMA_NOT_READY:${report.database.status}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "CANDIDATE_PRODUCTION_SCHEMA_CHECK_FAILED");
  process.exitCode = 1;
});
