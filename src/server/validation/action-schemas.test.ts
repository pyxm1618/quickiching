import { describe, expect, it } from "vitest";
import { DomainError } from "@/server/errors/domain-error";
import { actionSchemas, parseActionInput } from "./action-schemas";

const castingId = "cas_0123456789abcdef01234567";
const readingId = "rdg_0123456789abcdef01234567";

describe("action input schemas", () => {
  it("rejects malformed resource IDs before an action can query the repository", () => {
    expect(() => parseActionInput(actionSchemas.castingId, { castingId: "not-a-casting-id" }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "castingId" }));
    expect(() => parseActionInput(actionSchemas.submitQualityReview, { readingId: "missing-prefix", reason: "The answer overlooked the stated timing." }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "readingId" }));
  });

  it("rejects a casting method outside the supported methods", () => {
    expect(() => parseActionInput(actionSchemas.createCastingSession, {
      method: "cards",
      scene: "career",
      interpretationGoal: "what_do_i_need_to_see_clearly",
    })).toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "method" }));
  });

  it("rejects line and change indices outside the casting sequence", () => {
    expect(() => parseActionInput(actionSchemas.generateThreeCoinLine, { castingId, lineIndex: 6 }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "lineIndex" }));
    expect(() => parseActionInput(actionSchemas.generateYarrowChange, { castingId, lineIndex: 0, changeIndex: 3 }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "changeIndex" }));
  });

  it("rejects an invalid IANA time zone before Mei Hua calculation", () => {
    expect(() => parseActionInput(actionSchemas.createMeiHuaResult, { castingId, ianaTimeZone: "Mars/Olympus" }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "ianaTimeZone" }));
  });

  it("normalizes valid email input and rejects invalid email input", () => {
    expect(parseActionInput(actionSchemas.signIn, { email: "  Reader@Example.com " })).toEqual({ email: "reader@example.com" });
    expect(() => parseActionInput(actionSchemas.signIn, { email: "reader-at-example.com" }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "email" }));
  });

  it("rejects question contexts outside the public length boundary", () => {
    expect(() => parseActionInput(actionSchemas.submitQuestion, { castingId, context: "too short" }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "context" }));
    expect(() => parseActionInput(actionSchemas.submitQuestion, { castingId, context: "a".repeat(1001) }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "context" }));
  });

  it("rejects empty and overlong quality-review reasons", () => {
    expect(() => parseActionInput(actionSchemas.submitQualityReview, { readingId, reason: "   " }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "reason" }));
    expect(() => parseActionInput(actionSchemas.submitQualityReview, { readingId, reason: "a".repeat(2001) }))
      .toThrow(expect.objectContaining({ code: "INVALID_ACTION_INPUT", field: "reason" }));
  });

  it("uses a safe generic public message for schema failures", () => {
    try {
      parseActionInput(actionSchemas.signIn, { email: "reader-at-example.com" });
      throw new Error("expected parseActionInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ publicMessage: "Invalid request input", retryable: false });
    }
  });
});
