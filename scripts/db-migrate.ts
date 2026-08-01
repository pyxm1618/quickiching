import postgres from "postgres";
import { LATEST_MIGRATION_ID, migratePostgres } from "../src/server/db/migrate";
import { resolveMigrationDatabaseUrl } from "../src/server/db/migration-url";

const databaseUrl = resolveMigrationDatabaseUrl();
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
