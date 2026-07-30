import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  castingSessions,
  castingSteps,
  castResults,
  entitlementBatches,
  entitlementLedger,
  generationJobs,
  loginIntents,
  previews,
  qualityReviews,
  questionLocks,
  readings,
  reservations,
  webhookInbox,
} from "./schema";

function indexNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

function checkNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).checks.map((check) => check.name);
}

describe("PostgreSQL schema contracts", () => {
  it("serializes active ownership independently for authenticated and anonymous castings", () => {
    expect(indexNames(castingSessions)).toEqual(expect.arrayContaining([
      "casting_active_user_unique",
      "casting_active_anonymous_unique",
    ]));
  });

  it("uses separate partial unique indexes for nullable and non-null casting step identities", () => {
    expect(indexNames(castingSteps)).toEqual(expect.arrayContaining([
      "casting_step_without_change_unique",
      "casting_yarrow_change_unique",
    ]));
  });

  it("enforces one result, preview, and reading per casting", () => {
    expect(getTableConfig(castResults).primaryKeys).toHaveLength(1);
    expect(indexNames(previews)).toContain("preview_casting_unique");
    expect(indexNames(readings)).toContain("reading_casting_unique");
  });

  it("makes Login Intent nonces and webhook events idempotent", () => {
    expect(indexNames(loginIntents)).toContain("login_intent_nonce_unique");
    expect(indexNames(webhookInbox)).toContain("webhook_provider_event_unique");
  });

  it("keys question locks by user, fingerprint, and key version", () => {
    expect(getTableConfig(questionLocks).primaryKeys).toHaveLength(1);
    const primary = getTableConfig(questionLocks).primaryKeys[0];
    expect(primary.columns.map((column) => column.name)).toEqual([
      "user_id",
      "question_fingerprint",
      "fingerprint_key_version",
    ]);
  });

  it("enforces non-negative entitlement counters and the batch identity", () => {
    expect(checkNames(entitlementBatches)).toEqual(expect.arrayContaining([
      "entitlement_total_nonnegative",
      "entitlement_available_nonnegative",
      "entitlement_reserved_nonnegative",
      "entitlement_consumed_nonnegative",
      "entitlement_revoked_nonnegative",
      "entitlement_batch_identity",
    ]));
  });

  it("stores immutable ledger events and exactly one terminal reservation event", () => {
    expect(indexNames(entitlementLedger)).toContain("entitlement_ledger_event_unique");
    expect(indexNames(reservations)).toEqual(expect.arrayContaining([
      "reservation_reading_active_unique",
      "reservation_terminal_event_unique",
    ]));
  });

  it("supports fenced generation and one review per delivered reading", () => {
    expect(indexNames(generationJobs)).toContain("generation_active_snapshot_unique");
    expect(indexNames(qualityReviews)).toContain("quality_review_reading_unique");
  });
});
