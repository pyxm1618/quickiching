import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

export function createDrizzleDatabase(databaseUrl: string) {
  if (!databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    throw new Error("POSTGRES_DATABASE_URL_INVALID");
  }
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
  return {
    client,
    db: drizzle(client),
    close: () => client.end(),
  };
}
