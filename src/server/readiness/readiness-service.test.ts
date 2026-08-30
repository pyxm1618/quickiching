import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkSystemReadiness,
  REQUIRED_COMMERCIAL_TABLES,
  REQUIRED_MIGRATION_CHECKPOINT_AT,
} from "./readiness-service";

const LATEST_CP5_MIGRATION_AT = 1787797500000;

function validCommercialEnv(): Record<string, string> {
  return {
    COMMERCIAL_V2_AUTH_ENABLED: "true",
    COMMERCIAL_V2_AI_PREVIEW_ENABLED: "true",
    COMMERCIAL_V2_CHECKOUT_ENABLED: "true",
    COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "true",
    COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "true",
    COMMERCIAL_V2_RECONCILE_ENABLED: "true",
    AUTH_ADAPTER_MODE: "better-auth",
    DATABASE_ADAPTER_MODE: "postgres",
    DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/quickiching",
    BETTER_AUTH_SECRET: "better-auth-secret-at-least-32-characters-long",
    ANONYMOUS_OWNER_KEYS: "v1:anonymous-owner-material-000000000001",
    BETTER_AUTH_URL: "https://staging.quickiching.com",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@staging.quickiching.com",
    AI_ADAPTER_MODE: "ai-sdk",
    AI_GATEWAY_API_KEY: "ai-gateway-test-key",
    AI_GATEWAY_BASE_URL: "https://ai-gateway.example.test",
    AI_SDK_GATEWAY_BASE_URL: "https://ai-sdk-gateway.example.test",
    APP_SECRET: "application-secret-at-least-32-characters-long",
    AI_MODEL_OUTPUT_REVIEW: "review-model",
    QUESTION_FINGERPRINT_KEYS: "v1:question-fingerprint-material-00000001",
    QUESTION_ENCRYPTION_KEYS: "v1:question-encryption-material-00000002",
    RESULT_INTEGRITY_KEYS: "v1:result-integrity-material-00000003",
    AI_MODEL_PREVIEW: "preview-model",
    AI_MODEL_DEEP_READING: "deep-model",
    AI_MAX_OUTPUT_TOKENS: "1024",
    AI_MAX_REVIEW_OUTPUT_TOKENS: "512",
    PAYMENT_ADAPTER_MODE: "waffo",
    WAFFO_ENVIRONMENT: "test",
    WAFFO_STORE_ID: "staging-store",
    WAFFO_MERCHANT_ID: "staging-merchant",
    WAFFO_PRIVATE_KEY: "staging-private-key",
    WAFFO_TEST_PRODUCT_ID_ONE: "test-product-one",
    WAFFO_TEST_PRODUCT_ID_THREE: "test-product-three",
    WAFFO_TEST_PRODUCT_ID_FIVE: "test-product-five",
    APP_BASE_URL: "https://staging.quickiching.com",
    PAYMENT_CHECKOUT_URL_KEYS: "v1:checkout-url-material-000000000000004",
    SESSION_SIGNING_KEYS: "v1:session-signing-material-0000000000005",
    WORKFLOW_ADAPTER_MODE: "vercel",
    CRON_SECRET: "staging-cron-secret",
  };
}

function readyDbOverride(migrations: number[] = [LATEST_CP5_MIGRATION_AT]) {
  return {
    ping: async () => {},
    queryTables: async () => [...REQUIRED_COMMERCIAL_TABLES],
    queryMigrationTimestamps: async () => migrations,
  } as any;
}

describe("System Readiness Service", () => {
  it("reports blocked when all commercial capabilities are disabled or unconfigured", async () => {
    const env: Record<string, string> = {
      COMMERCIAL_V2_AUTH_ENABLED: "false",
      COMMERCIAL_V2_AI_PREVIEW_ENABLED: "false",
      COMMERCIAL_V2_CHECKOUT_ENABLED: "false",
      COMMERCIAL_V2_WEBHOOK_INGESTION_ENABLED: "false",
      COMMERCIAL_V2_PAID_DEEP_READING_ENABLED: "false",
      COMMERCIAL_V2_RECONCILE_ENABLED: "false",
    };

    const report = await checkSystemReadiness(env);
    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("not_configured");
    expect(report.capabilities.auth.enabled).toBe(false);
  });

  it("reports blocked when only a subset of required commercial capabilities is enabled", async () => {
    const env = validCommercialEnv();
    env.COMMERCIAL_V2_AI_PREVIEW_ENABLED = "false";
    env.COMMERCIAL_V2_CHECKOUT_ENABLED = "false";
    env.COMMERCIAL_V2_PAID_DEEP_READING_ENABLED = "false";

    const report = await checkSystemReadiness(env, readyDbOverride());

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.capabilities.auth.enabled).toBe(true);
    expect(report.capabilities.aiPreview.enabled).toBe(false);
  });

  it("reports blocked when commercial database is unavailable", async () => {
    const env = validCommercialEnv();
    const report = await checkSystemReadiness(env, {
      ping: async () => {
        throw new Error("Connection refused");
      },
    });

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("error");
    expect(report.database.connected).toBe(false);
  });

  it("requires the full commercial persistence surface, including outbox and reservation tables", () => {
    expect(REQUIRED_COMMERCIAL_TABLES).toContain("payment_outbox");
    expect(REQUIRED_COMMERCIAL_TABLES).toContain("entitlement_batches");
    expect(REQUIRED_COMMERCIAL_TABLES).toContain("entitlement_reservations");
    expect(REQUIRED_COMMERCIAL_TABLES).toContain("deep_reading_results");
    expect(REQUIRED_COMMERCIAL_TABLES).toContain("generation_output_reviews");
  });

  it("reports blocked when required commercial tables are missing from database", async () => {
    const env = validCommercialEnv();
    const report = await checkSystemReadiness(env, {
      ping: async () => {},
      queryTables: async () => ["users", "sessions"],
      queryMigrationTimestamps: async () => [LATEST_CP5_MIGRATION_AT],
    } as any);

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("tables_missing");
    expect(report.database.missingTables).toContain("payment_orders");
    expect(report.database.missingTables).toContain("payment_outbox");
    expect(report.database.missingTables).toContain("entitlement_reservations");
  });

  it("reports blocked when the Drizzle migration log is missing", async () => {
    const env = validCommercialEnv();
    const report = await checkSystemReadiness(env, readyDbOverride([]));

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("migration_missing");
  });

  it("reports blocked when the Drizzle migration log is behind the CP5 checkpoint", async () => {
    const env = validCommercialEnv();
    const report = await checkSystemReadiness(env, readyDbOverride([1787757784089]));

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("migration_outdated");
  });

  it("reports ready only when every required commercial capability, table, and migration is satisfied", async () => {
    const env = validCommercialEnv();
    const report = await checkSystemReadiness(env, readyDbOverride());

    expect(report.status).toBe("ready");
    expect(report.overall).toBe("ready");
    expect(report.database.status).toBe("ok");
    expect(report.database.connected).toBe(true);
    for (const capability of Object.values(report.capabilities)) {
      expect(capability.requested).toBe(true);
      expect(capability.enabled).toBe(true);
    }
  });

  it("pins the migration checkpoint to the newest entry in the Drizzle journal", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { when: number; tag: string }[];
    };
    const newest = Math.max(...journal.entries.map((entry) => entry.when));

    // A new migration without a checkpoint bump would let a deployment that is
    // missing that migration still report ready.
    expect(REQUIRED_MIGRATION_CHECKPOINT_AT).toBe(newest);
  });

  it("never includes secret values in readiness report", async () => {    const secretValue = "super-secret-key-12345-do-not-leak";
    const env = validCommercialEnv();
    env.BETTER_AUTH_SECRET = secretValue;

    const report = await checkSystemReadiness(env, readyDbOverride());
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secretValue);
    expect(serialized).not.toContain("postgresql://");
  });
});
