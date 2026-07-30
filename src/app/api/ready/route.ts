import { runtimeConfig } from "@/server/config";
import { createPostgresPersistence } from "@/server/repositories/postgres";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const config = runtimeConfig();
  if (config.mode !== "production") {
    return Response.json({ status: "ready", mode: config.mode }, {
      headers: { "cache-control": "no-store" },
    });
  }

  const persistence = createPostgresPersistence(config.credentials.databaseUrl);
  try {
    const [database] = await persistence.sql`select 1 as ready`;
    const [migrations] = await persistence.sql`
      select count(*)::int as count from _app_migrations
      where id in ('0000_v2_1', '0001_auth_payment', '0002_generation_runtime')
    `;
    const ready = Number(database?.ready) === 1 && Number(migrations?.count) === 3;
    return Response.json({
      status: ready ? "ready" : "not_ready",
      database: Boolean(database),
      migrations: Number(migrations?.count ?? 0),
      adapters: {
        ai: config.ai,
        auth: config.auth,
        payment: config.payment,
        database: config.database,
        workflow: config.workflow,
      },
    }, {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ status: "not_ready", database: false }, {
      status: 503,
      headers: { "cache-control": "no-store" },
    });
  } finally {
    await persistence.close();
  }
}
