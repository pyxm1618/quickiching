import type { Sql } from "postgres";
import { LATEST_MIGRATION_ID } from "./migrate";

type RuntimeDatabaseEnvironment = Record<string, string | undefined>;

export type RuntimeDatabaseFailure =
  | "authentication_failed"
  | "connection_failed"
  | "configuration_invalid"
  | "schema_not_ready"
  | "unknown";

export function resolveRuntimeDatabaseUrl(
  env: RuntimeDatabaseEnvironment = process.env,
): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error("RUNTIME_DATABASE_URL_REQUIRED");

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error("protocol");
    }
  } catch {
    throw new Error("RUNTIME_DATABASE_URL_INVALID");
  }

  return value;
}

export async function verifyRuntimeDatabaseSchema(sql: Sql): Promise<void> {
  const [connection] = await sql`select 1 as ready`;
  if (Number(connection?.ready) !== 1) {
    throw new Error("RUNTIME_DATABASE_CONNECTION_CHECK_FAILED");
  }

  const migrations = await sql`
    select id from _app_migrations where id = ${LATEST_MIGRATION_ID}
  `;
  if (migrations.length !== 1) {
    throw new Error("RUNTIME_DATABASE_SCHEMA_NOT_READY");
  }
}

export function classifyRuntimeDatabaseFailure(
  error: unknown,
): RuntimeDatabaseFailure {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : "";

  if (code === "28P01") return "authentication_failed";
  if (
    code.startsWith("08")
    || code === "57P03"
    || ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT"].includes(code)
  ) {
    return "connection_failed";
  }
  if (message === "RUNTIME_DATABASE_SCHEMA_NOT_READY" || code === "42P01") {
    return "schema_not_ready";
  }
  if (message.startsWith("RUNTIME_DATABASE_URL_")) {
    return "configuration_invalid";
  }
  return "unknown";
}
