import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { authTables } from "./auth-schema";
import { databaseSchema } from "./schema";

const DEFAULT_RUNTIME_POOL_MAX = 5;

export type AuthDatabase = PostgresJsDatabase<typeof authTables>;
export type AuthDatabaseConnection = { db: AuthDatabase; client: Sql };
export type CommercialDatabase = PostgresJsDatabase<typeof databaseSchema>;
export type CommercialDatabaseConnection = { db: CommercialDatabase; client: Sql };

let runtimeConnection: AuthDatabaseConnection | undefined;
let runtimeConnectionUrl: string | undefined;
let runtimeCommercialConnection: CommercialDatabaseConnection | undefined;
let runtimeCommercialConnectionUrl: string | undefined;

function createRuntimeClient(url: string): Sql {
  return postgres(url, { max: DEFAULT_RUNTIME_POOL_MAX, prepare: false });
}

export function createAuthDatabaseConnection(
  url: string,
  options: { max?: number } = {},
): AuthDatabaseConnection {
  const client = postgres(url, {
    max: options.max ?? DEFAULT_RUNTIME_POOL_MAX,
    // Pooled/serverless URLs can reject prepared statements. Better Auth does
    // not require them, so the runtime contract is explicit and portable.
    prepare: false,
  });
  return { client, db: drizzle(client, { schema: authTables }) };
}

export function getAuthDatabaseConnection(url = process.env.DATABASE_URL): AuthDatabaseConnection {
  const candidate = url?.trim();
  if (!candidate) throw new Error("AUTH_DATABASE_UNAVAILABLE");
  if (!runtimeConnection) {
    const client = runtimeCommercialConnection && runtimeCommercialConnectionUrl === candidate
      ? runtimeCommercialConnection.client
      : createRuntimeClient(candidate);
    runtimeConnection = { client, db: drizzle(client, { schema: authTables }) };
    runtimeConnectionUrl = candidate;
  }
  return runtimeConnection;
}

export function createCommercialDatabaseConnection(
  url: string,
  options: { max?: number } = {},
): CommercialDatabaseConnection {
  const client = postgres(url, {
    max: options.max ?? DEFAULT_RUNTIME_POOL_MAX,
    prepare: false,
  });
  return { client, db: drizzle(client, { schema: databaseSchema }) };
}

export function getCommercialDatabaseConnection(url = process.env.DATABASE_URL): CommercialDatabaseConnection {
  const candidate = url?.trim();
  if (!candidate) throw new Error("COMMERCIAL_DATABASE_UNAVAILABLE");
  if (!runtimeCommercialConnection) {
    const client = runtimeConnection && runtimeConnectionUrl === candidate
      ? runtimeConnection.client
      : createRuntimeClient(candidate);
    runtimeCommercialConnection = { client, db: drizzle(client, { schema: databaseSchema }) };
    runtimeCommercialConnectionUrl = candidate;
  }
  return runtimeCommercialConnection;
}

export function getPostgresClient(url = process.env.DATABASE_URL): Sql {
  return getCommercialDatabaseConnection(url).client;
}

export async function closeAuthDatabaseConnection(): Promise<void> {
  if (!runtimeConnection) return;
  const connection = runtimeConnection;
  runtimeConnection = undefined;
  runtimeConnectionUrl = undefined;
  if (runtimeCommercialConnection?.client !== connection.client) {
    await connection.client.end({ timeout: 5 });
  }
}

export async function closeCommercialDatabaseConnection(): Promise<void> {
  if (!runtimeCommercialConnection) return;
  const connection = runtimeCommercialConnection;
  runtimeCommercialConnection = undefined;
  runtimeCommercialConnectionUrl = undefined;
  if (runtimeConnection?.client !== connection.client) {
    await connection.client.end({ timeout: 5 });
  }
}

export function migrationDatabaseURL(env: Record<string, string | undefined> = process.env): string {
  const candidate = env.MIGRATION_DATABASE_URL?.trim() || env.DATABASE_URL?.trim();
  if (!candidate) throw new Error("MIGRATION_DATABASE_UNAVAILABLE");
  return candidate;
}
