import { runtimeConfig } from "@/server/config";
import { LATEST_MIGRATION_ID } from "@/server/db/migrate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const config = runtimeConfig();
  if (config.mode !== "production") {
    return Response.json({ status: "ready", adapter: "memory" }, {
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const { getProductionRuntime } = await import("@/server/runtime/production");
    const production = await getProductionRuntime();
    const [database] = await production.sql`select 1 as ready`;
    const migrations = await production.sql`
      select id from _app_migrations where id = ${LATEST_MIGRATION_ID}
    `;
    if (Number(database.ready) !== 1 || migrations.length !== 1) {
      throw new Error("READINESS_MIGRATION_MISSING");
    }
    return Response.json({ status: "ready", adapter: "postgres" }, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ status: "not_ready" }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  }
}
