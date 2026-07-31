import postgres from "postgres";
import { LATEST_MIGRATION_ID, migratePostgres } from "../src/server/db/migrate";

const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_TEST_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for db:migrate");
}

const sql = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
  prepare: false,
});

try {
  await migratePostgres(sql);
  console.log(`Applied database migrations through ${LATEST_MIGRATION_ID}`);
} finally {
  await sql.end();
}
