import { describe, expect, it } from "vitest";
import {
  classifyRuntimeDatabaseFailure,
  resolveRuntimeDatabaseUrl,
} from "./runtime-database-verification";

describe("runtime database verification", () => {
  it("accepts a PostgreSQL runtime URL without returning it in errors", () => {
    expect(
      resolveRuntimeDatabaseUrl({
        DATABASE_URL: "postgresql://user:password@db.example.test/app",
      }),
    ).toBe("postgresql://user:password@db.example.test/app");
  });

  it("classifies authentication and connectivity failures without error messages", () => {
    expect(classifyRuntimeDatabaseFailure({ code: "28P01" })).toBe(
      "authentication_failed",
    );
    expect(classifyRuntimeDatabaseFailure({ code: "ECONNREFUSED" })).toBe(
      "connection_failed",
    );
  });

  it("identifies a runtime database that is missing the latest migration", () => {
    expect(
      classifyRuntimeDatabaseFailure(new Error("RUNTIME_DATABASE_SCHEMA_NOT_READY")),
    ).toBe("schema_not_ready");
  });
});
