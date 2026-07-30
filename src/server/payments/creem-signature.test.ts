import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCreemSignature } from "./creem-signature";

const secret = "whsec_test_secret";
const rawBody = '{"id":"evt_1","eventType":"checkout.completed","object":{"id":"ch_1"}}';

function sign(payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

describe("verifyCreemSignature", () => {
  it("accepts the exact raw request body", () => {
    expect(verifyCreemSignature(rawBody, sign(rawBody), secret)).toBe(true);
  });

  it("rejects a semantically equal body whose bytes changed", () => {
    const reformatted = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(verifyCreemSignature(reformatted, sign(rawBody), secret)).toBe(false);
  });

  it.each(["", "not-hex", "abc", "00".repeat(31), "00".repeat(33)])(
    "rejects malformed signatures without throwing: %s",
    (signature) => {
      expect(() => verifyCreemSignature(rawBody, signature, secret)).not.toThrow();
      expect(verifyCreemSignature(rawBody, signature, secret)).toBe(false);
    },
  );
});
