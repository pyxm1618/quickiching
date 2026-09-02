import { describe, expect, it } from "vitest";
import {
  ORDER_POLL_BASE_DELAY_MS,
  ORDER_POLL_MAX_DELAY_MS,
  classifyOrderResponse,
  nextPollDelayMs,
} from "./order-poll";

describe("order poll backoff", () => {
  it("starts at the base delay", () => {
    expect(nextPollDelayMs(1)).toBe(ORDER_POLL_BASE_DELAY_MS);
  });

  it("never returns less than the base delay for a nonsensical attempt", () => {
    expect(nextPollDelayMs(0)).toBe(ORDER_POLL_BASE_DELAY_MS);
    expect(nextPollDelayMs(-3)).toBe(ORDER_POLL_BASE_DELAY_MS);
  });

  it("increases monotonically and settles at the ceiling", () => {
    const delays = [1, 2, 3, 4, 5, 6, 7, 8, 20].map(nextPollDelayMs);
    for (let index = 1; index < delays.length; index += 1) {
      expect(delays[index]!).toBeGreaterThanOrEqual(delays[index - 1]!);
    }
    expect(delays.at(-1)).toBe(ORDER_POLL_MAX_DELAY_MS);
    expect(Math.max(...delays)).toBeLessThanOrEqual(ORDER_POLL_MAX_DELAY_MS);
  });
});

describe("order status classification", () => {
  const order = { status: "paid", productKey: "three", quantity: 3 };

  it("treats paid as settled", () => {
    expect(classifyOrderResponse(200, order)).toEqual({ kind: "paid", order });
  });

  it.each(["pending", "checkout_initializing", "checkout_created"])(
    "keeps waiting while the order is %s",
    (status) => {
      expect(classifyOrderResponse(200, { ...order, status }).kind).toBe("pending");
    },
  );

  it("surfaces refunded and financial_review as their own outcomes", () => {
    expect(classifyOrderResponse(200, { ...order, status: "refunded" }).kind).toBe("refunded");
    expect(classifyOrderResponse(200, { ...order, status: "financial_review" }).kind).toBe("review");
  });

  it("maps auth and ownership answers without inventing a payment", () => {
    expect(classifyOrderResponse(401, null).kind).toBe("unauthorized");
    expect(classifyOrderResponse(404, null).kind).toBe("not_found");
  });

  it.each([500, 503, 429, 302])("treats HTTP %s as unavailable rather than terminal", (status) => {
    expect(classifyOrderResponse(status, order).kind).toBe("unavailable");
  });

  it.each([
    ["null", null],
    ["a string", "paid"],
    ["a missing status", { productKey: "three", quantity: 3 }],
    ["a blank status", { status: "", productKey: "three", quantity: 3 }],
    ["an unknown status", { status: "settled_somehow", productKey: "three", quantity: 3 }],
    ["a non-numeric quantity", { status: "paid", productKey: "three", quantity: "3" }],
    ["a missing product key", { status: "paid", quantity: 3 }],
  ])("never reads %s as paid", (_label, body) => {
    expect(classifyOrderResponse(200, body).kind).toBe("unavailable");
  });
});
