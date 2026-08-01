import { describe, expect, it } from "vitest";
import { resolveMigrationDatabaseUrl } from "./migration-url";

describe("migration database URL resolution", () => {
  it("accepts an explicit direct production connection", () => {
    const url = "postgresql://user:secret@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require";

    expect(resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: url,
    })).toBe(url);
  });

  it("accepts POSTGRES_TEST_URL for isolated test databases", () => {
    const url = "postgres://postgres:postgres@localhost:5432/iching_test";

    expect(resolveMigrationDatabaseUrl({
      POSTGRES_TEST_URL: url,
    })).toBe(url);
  });

  it("does not fall back to the pooled application DATABASE_URL", () => {
    expect(() => resolveMigrationDatabaseUrl({
      DATABASE_URL: "postgresql://user:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb",
    })).toThrow(
      "MIGRATION_DATABASE_URL_REQUIRED: set DATABASE_URL_UNPOOLED or POSTGRES_TEST_URL",
    );
  });

  it("rejects pooled connection strings even when supplied as the migration URL", () => {
    expect(() => resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: "postgresql://user:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb",
    })).toThrow(
      "MIGRATION_DATABASE_URL_POOLED_FORBIDDEN: DATABASE_URL_UNPOOLED must use a direct connection",
    );
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(() => resolveMigrationDatabaseUrl({
      DATABASE_URL_UNPOOLED: "https://example.com/database",
    })).toThrow(
      "MIGRATION_DATABASE_URL_INVALID: DATABASE_URL_UNPOOLED must be a PostgreSQL URL",
    );
  });
});
