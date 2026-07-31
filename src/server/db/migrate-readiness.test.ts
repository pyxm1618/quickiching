import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";
import {
  assertPostgresSchemaReady,
  LATEST_MIGRATION_ID,
  MIGRATION_IDS,
} from "./migrate";

function sqlReturning(rows: Array<{ id: string }>): Sql {
  return vi.fn(async () => rows) as unknown as Sql;
}

describe("PostgreSQL schema readiness", () => {
  it("rejects a database that contains only the latest migration marker", async () => {
    await expect(assertPostgresSchemaReady(sqlReturning([
      { id: LATEST_MIGRATION_ID },
    ]))).rejects.toThrow("DATABASE_SCHEMA_NOT_READY: missing 0000_v2_1");
  });

  it("accepts a database containing every ordered migration marker", async () => {
    await expect(assertPostgresSchemaReady(sqlReturning(
      MIGRATION_IDS.map((id) => ({ id })),
    ))).resolves.toBeUndefined();
  });
});
