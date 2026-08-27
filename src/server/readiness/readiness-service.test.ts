import { describe, expect, it } from "vitest";
import {
  checkSystemReadiness,
  REQUIRED_COMMERCIAL_TABLES,
} from "./readiness-service";

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

  it("reports blocked when commercial capability is requested but database is unavailable", async () => {
    const env: Record<string, string> = {
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/quickiching",
      BETTER_AUTH_SECRET: "secret-better-auth-key-at-least-32-chars-long",
      ANONYMOUS_OWNER_KEYS: "v1:k1:bWF0ZXJpYWwtMS1hdC1sZWFzdC0zMi1ieXRlcy1sb25n",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      RESEND_API_KEY: "re_12345678",
      EMAIL_FROM: "test@quickiching.com",
    };

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

  it("reports blocked when required commercial tables are missing from database", async () => {
    const env: Record<string, string> = {
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/quickiching",
      BETTER_AUTH_SECRET: "secret-better-auth-key-at-least-32-chars-long",
      ANONYMOUS_OWNER_KEYS: "v1:k1:bWF0ZXJpYWwtMS1hdC1sZWFzdC0zMi1ieXRlcy1sb25n",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      RESEND_API_KEY: "re_12345678",
      EMAIL_FROM: "test@quickiching.com",
    };

    const report = await checkSystemReadiness(env, {
      ping: async () => {},
      queryTables: async () => ["users", "sessions"], // missing most tables
    });

    expect(report.status).toBe("not_ready");
    expect(report.overall).toBe("blocked");
    expect(report.database.status).toBe("tables_missing");
    expect(report.database.missingTables).toContain("payment_orders");
    expect(report.database.missingTables).toContain("entitlement_ledger");
  });

  it("reports ready when all required tables exist and capabilities are satisfied", async () => {
    const env: Record<string, string> = {
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      AUTH_ADAPTER_MODE: "better-auth",
      DATABASE_ADAPTER_MODE: "postgres",
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/quickiching",
      BETTER_AUTH_SECRET: "secret-better-auth-key-at-least-32-chars-long",
      ANONYMOUS_OWNER_KEYS: "v1:k1:bWF0ZXJpYWwtMS1hdC1sZWFzdC0zMi1ieXRlcy1sb25n",
      BETTER_AUTH_URL: "https://staging.quickiching.com",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      RESEND_API_KEY: "re_12345678",
      EMAIL_FROM: "test@quickiching.com",
    };

    const report = await checkSystemReadiness(env, {
      ping: async () => {},
      queryTables: async () => [...REQUIRED_COMMERCIAL_TABLES],
    });

    expect(report.status).toBe("ready");
    expect(report.overall).toBe("ready");
    expect(report.database.status).toBe("ok");
    expect(report.database.connected).toBe(true);
    expect(report.capabilities.auth.enabled).toBe(true);
  });

  it("never includes secret values in readiness report", async () => {
    const secretValue = "super-secret-key-12345-do-not-leak";
    const env: Record<string, string> = {
      COMMERCIAL_V2_AUTH_ENABLED: "true",
      BETTER_AUTH_SECRET: secretValue,
      DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/quickiching",
    };

    const report = await checkSystemReadiness(env, {
      ping: async () => {},
      queryTables: async () => [...REQUIRED_COMMERCIAL_TABLES],
    });

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secretValue);
    expect(serialized).not.toContain("postgresql://");
  });
});
