import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../drizzle/0011_payment_closeout.sql", import.meta.url),
  "utf8",
);
const journal = readFileSync(
  new URL("../../../drizzle/meta/_journal.json", import.meta.url),
  "utf8",
);

describe("0011 payment closeout migration", () => {
  it("uses signed provider eventId as the only cross-delivery unique identity", () => {
    expect(migration).toContain("DROP INDEX IF EXISTS payment_inbox_delivery_idx");
    expect(migration).toContain("CREATE INDEX payment_inbox_delivery_idx");
    expect(migration).not.toContain("CREATE UNIQUE INDEX payment_inbox_delivery_idx");
    expect(migration).toContain("CREATE UNIQUE INDEX payment_inbox_business_event_idx");
    expect(migration).toContain("provider, provider_environment, event_id");
    expect(migration).toContain("PAYMENT_WEBHOOK_EVENT_ID_CONFLICT");
  });

  it("creates a durable one-refund-intent-per-order state machine with leases", () => {
    expect(migration).toContain("CREATE TABLE refund_intents");
    expect(migration).toContain("order_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("provider_write_state");
    expect(migration).toContain("provider_ticket_id");
    expect(migration).toContain("refund_ticket_merchant_external_id");
    expect(migration).toContain("reconcile_lease_token");
    expect(migration).toContain("reconcile_lease_expires_at");
    expect(migration).toContain("reconcile_attempt_count");
  });

  it("is registered in the drizzle migration journal", () => {
    expect(journal).toContain('"tag": "0011_payment_closeout"');
  });
});
