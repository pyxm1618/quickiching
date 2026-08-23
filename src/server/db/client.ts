import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { authTables } from "./auth-schema";

export type AuthDatabase = PostgresJsDatabase<typeof authTables>;
export type AuthDatabaseConnection = { db: AuthDatabase; client: Sql };

let runtimeConnection: AuthDatabaseConnection | undefined;

export function createAuthDatabaseConnection(
  url: string,
  options: { max?: number } = {},
): AuthDatabaseConnection {
  const client = postgres(url, {
    max: options.max ?? 10,
    // Pooled/serverless URLs can reject prepared statements. Better Auth does
    // not require them, so the runtime contract is explicit and portable.
    prepare: false,
  });
  return { client, db: drizzle(client, { schema: authTables }) };
}

export function getAuthDatabaseConnection(url = process.env.DATABASE_URL): AuthDatabaseConnection {
  const candidate = url?.trim();
  if (!candidate) throw new Error("AUTH_DATABASE_UNAVAILABLE");
  if (!runtimeConnection) runtimeConnection = createAuthDatabaseConnection(candidate);
  return runtimeConnection;
}

export async function closeAuthDatabaseConnection(): Promise<void> {
  if (!runtimeConnection) return;
  const connection = runtimeConnection;
  runtimeConnection = undefined;
  await connection.client.end({ timeout: 5 });
}

export function migrationDatabaseURL(env: Record<string, string | undefined> = process.env): string {
  const candidate = env.MIGRATION_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!candidate) throw new Error("MIGRATION_DATABASE_UNAVAILABLE");
  return candidate;
}
