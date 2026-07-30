import postgres, { type Sql } from "postgres";
import { migratePostgres } from "@/server/db/migrate";
import { PostgresAtomicRepository } from "./atomic-repository";

export type PostgresPersistence = {
  sql: Sql;
  atomicRepository: PostgresAtomicRepository;
  migrate(): Promise<void>;
  close(): Promise<void>;
};

export function createPostgresPersistence(databaseUrl: string): PostgresPersistence {
  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    throw new Error("POSTGRES_DATABASE_URL_INVALID");
  }

  const sql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  const atomicRepository = new PostgresAtomicRepository(sql);

  return {
    sql,
    atomicRepository,
    migrate: () => migratePostgres(sql),
    close: () => sql.end(),
  };
}

export { PostgresAtomicRepository } from "./atomic-repository";
