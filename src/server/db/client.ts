import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type PostgresDatabase = PostgresJsDatabase<typeof schema>;

export type PostgresDatabaseHandle = {
  db: PostgresDatabase;
  close(): Promise<void>;
};

export function createPostgresDatabase(databaseUrl: string): PostgresDatabaseHandle {
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error("POSTGRES_DATABASE_URL_INVALID");
  }
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return {
    db: drizzle(client, { schema }),
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
