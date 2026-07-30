import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors/domain-error";

const auth = vi.hoisted(() => ({
  getAnonymousHash: vi.fn(),
  getCurrentUser: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  ownsCasting: vi.fn(),
  requestCastingDeletion: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAnonymousHash: auth.getAnonymousHash,
  getCurrentUser: auth.getCurrentUser,
  getOrCreateAnonymousHash: vi.fn(),
  devSignIn: vi.fn(),
}));
vi.mock("@/server/repository", () => ({ repo: repository }));

import { requestCastingDeletionAction } from "./actions";

const castingId = "cas_0123456789abcdef01234567";

describe("requestCastingDeletionAction error boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getAnonymousHash.mockResolvedValue("anon");
    auth.getCurrentUser.mockResolvedValue(null);
    repository.ownsCasting.mockReturnValue(true);
  });

  it("maps a known repository state failure to a safe action result", async () => {
    repository.requestCastingDeletion.mockImplementation(() => {
      throw new DomainError("CASTING_NOT_DELETABLE", "This casting cannot be deleted in its current state.", false);
    });

    await expect(requestCastingDeletionAction({ castingId })).resolves.toMatchObject({
      ok: false,
      error: {
        code: "CASTING_NOT_DELETABLE",
        message: "This casting cannot be deleted in its current state.",
        retryable: false,
      },
    });
  });

  it("logs only safe context then rethrows an unexpected repository failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unexpected = new TypeError("CASTING_NOT_DELETABLE");
    repository.requestCastingDeletion.mockImplementation(() => {
      throw unexpected;
    });

    await expect(requestCastingDeletionAction({ castingId })).rejects.toThrow(unexpected);
    expect(log).toHaveBeenCalledWith("Unexpected server action error", {
      action: "requestCastingDeletionAction",
      errorName: "TypeError",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("CASTING_NOT_DELETABLE");
    log.mockRestore();
  });
});
