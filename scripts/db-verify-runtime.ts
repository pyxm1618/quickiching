import postgres, { type Sql } from "postgres";
import { LATEST_MIGRATION_ID } from "../src/server/db/migrate";
import {
  classifyRuntimeDatabaseFailure,
  resolveRuntimeDatabaseUrl,
  verifyRuntimeDatabaseSchema,
} from "../src/server/db/runtime-database-verification";

let sql: Sql | undefined;

try {
  sql = postgres(resolveRuntimeDatabaseUrl(), {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    prepare: true,
  });
  await verifyRuntimeDatabaseSchema(sql);
  console.log(`Verified runtime database schema through ${LATEST_MIGRATION_ID}`);
} catch (error) {
  console.error(
    `Runtime database verification failed: ${classifyRuntimeDatabaseFailure(error)}`,
  );
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
