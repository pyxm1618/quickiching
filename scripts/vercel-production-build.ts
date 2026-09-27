import { spawnSync } from "node:child_process";
import { checkSystemReadiness } from "../src/server/readiness/readiness-service";
import { requireProductionDatabaseUrl } from "../src/server/readiness/production-schema-release";

function runApplicationBuild(): void {
  const result = spawnSync("bun", ["run", "build"], { stdio: "inherit" });
  if (result.error) throw new Error("VERCEL_APPLICATION_BUILD_START_FAILED");
  if (result.status !== 0) throw new Error(`VERCEL_APPLICATION_BUILD_FAILED:${result.status ?? "NO_EXIT_STATUS"}`);
}

async function main(): Promise<void> {
  if (process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production") {
    requireProductionDatabaseUrl(process.env.DATABASE_URL);
    const report = await checkSystemReadiness({ ...process.env, NODE_ENV: "production" });
    if (report.database.status !== "ok") {
      throw new Error(`VERCEL_PRODUCTION_SCHEMA_NOT_READY:${report.database.status}`);
    }
    console.log(`Vercel Production schema ready: ${report.database.appliedMigrationCount} migrations verified.`);
  }

  runApplicationBuild();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "VERCEL_PRODUCTION_BUILD_FAILED");
  process.exitCode = 1;
});
