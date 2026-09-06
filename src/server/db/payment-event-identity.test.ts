import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("payment webhook provider event identity", () => {
  it("dedupes one signed provider eventId regardless of event type", () => {
    const source = readFileSync(new URL("./payment-schema.ts", import.meta.url), "utf8");

    expect(source).toContain(
      'uniqueIndex("payment_inbox_business_event_idx").on(table.provider, table.providerEnvironment, table.eventId)',
    );
    expect(source).not.toContain(
      'uniqueIndex("payment_inbox_business_event_idx").on(table.provider, table.providerEnvironment, table.eventType, table.eventId)',
    );
  });

  it("does not use delivery id as a cross-event unique identity", () => {
    const source = readFileSync(new URL("./payment-schema.ts", import.meta.url), "utf8");

    expect(source).toContain(
      'index("payment_inbox_delivery_idx").on(table.provider, table.providerEnvironment, table.deliveryId)',
    );
    expect(source).not.toContain(
      'uniqueIndex("payment_inbox_delivery_idx").on(table.provider, table.providerEnvironment, table.deliveryId)',
    );
  });
});
