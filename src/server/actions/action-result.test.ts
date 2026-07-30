import { describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors/domain-error";
import { mapKnownDomainError } from "./action-result";

describe("mapKnownDomainError", () => {
  it("maps a DomainError to its intentional public action result", () => {
    const result = mapKnownDomainError(new DomainError(
      "CASTING_NOT_ACTIVE",
      "This casting cannot be changed in its current state.",
      false,
      "castingId",
    ), { action: "generateThreeCoinLineAction" });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "CASTING_NOT_ACTIVE",
        message: "This casting cannot be changed in its current state.",
        retryable: false,
        field: "castingId",
      },
    });
  });

  it("logs non-sensitive context and rethrows unexpected errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unexpected = new Error("database password=do-not-log");

    expect(() => mapKnownDomainError(unexpected, { action: "submitQuestionAction" })).toThrow(unexpected);
    expect(log).toHaveBeenCalledWith("Unexpected server action error", {
      action: "submitQuestionAction",
      errorName: "Error",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("database password=do-not-log");

    log.mockRestore();
  });
});
