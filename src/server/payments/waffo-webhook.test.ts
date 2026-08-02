import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhook } from "@waffo/pancake-ts";
import { parseWaffoWebhook, usdMinor } from "./waffo-webhook";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const event = { id: "delivery_1", timestamp: "2026-08-02T00:00:00.000Z", eventId: "PAY_1", eventType: "order.completed", storeId: "STO_test", mode: "test", data: { orderId: "ORD_1", buyerEmail: "buyer@example.com", currency: "USD", amount: "3.29", subtotal: "2.99", taxAmount: "0.30", total: "3.29", productName: "One", paymentId: "PAY_1", orderMerchantExternalId: "ord_1", orderMetadata: { orderId: "ord_1", internalProductId: "one" } } };

describe("Waffo webhook boundary", () => {
  it("verifies the unparsed raw body and rejects a changed body", () => {
    const raw = JSON.stringify(event);
    const timestamp = Date.now();
    const signature = sign("RSA-SHA256", Buffer.from(`${timestamp}.${raw}`), keys.privateKey).toString("base64");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyWebhook(raw, header, { environment: "test", publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString() })).toMatchObject({ id: "delivery_1" });
    expect(() => verifyWebhook(`${raw} `, header, { environment: "test", publicKey: keys.publicKey.export({ type: "spki", format: "pem" }).toString() })).toThrow();
  });
  it("keeps Test/Production mode explicit and retains tax values for product-policy validation", () => {
    expect(parseWaffoWebhook(event)).toMatchObject({ mode: "test", data: { subtotal: "2.99", taxAmount: "0.30", total: "3.29" } });
    expect(usdMinor("3.29")).toBe(329);
    expect(() => parseWaffoWebhook({ ...event, mode: "production" })).toThrow("WAFFO_WEBHOOK_SCHEMA_INVALID");
  });
});
