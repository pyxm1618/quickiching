import { describe, expect, it } from "vitest";
import { usdMinor } from "@/server/payments/waffo-webhook";

describe("Waffo payment invariants", () => {
  it("uses decimal-safe USD display amounts", () => {
    expect(usdMinor("2.99")).toBe(299);
    expect(() => usdMinor("2.999")).toThrow("WAFFO_AMOUNT_INVALID");
  });
});
