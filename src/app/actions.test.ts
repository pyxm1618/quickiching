import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/server/errors/domain-error";

const auth = vi.hoisted(() => ({
  getAnonymousHash: vi.fn(),
  getCurrentUser: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  ownsCasting: vi.fn(),
  getCastingSession: vi.fn(),
}));
const privacyRepository = vi.hoisted(() => ({
  requestCastingDeletion: vi.fn(),
  listRecoverableDeletedCasts: vi.fn(),
  restoreCasting: vi.fn(),
  purgeDeletedCasts: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getAnonymousHash: auth.getAnonymousHash,
  getCurrentUser: auth.getCurrentUser,
  getOrCreateAnonymousHash: vi.fn(),
  devSignIn: vi.fn(),
}));
vi.mock("@/server/repository", () => ({
  repo: repository,
  castingRepository: repository,
  loginIntentRepository: {},
  revealRepository: {},
  readingRepository: {},
  entitlementRepository: {},
  reviewRepository: {},
  privacyRepository,
}));

import { requestCastingDeletionAction } from "./actions";

const castingId = "cas_0123456789abcdef01234567";
const user = { id: "usr_test", email: "test@example.com" };

describe("requestCastingDeletionAction error boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getAnonymousHash.mockResolvedValue("anon");
    auth.getCurrentUser.mockResolvedValue(user);
    repository.ownsCasting.mockReturnValue(true);
    repository.getCastingSession.mockReturnValue({
      id: castingId,
      userId: user.id,
      lifecycle: "revealed",
    });
  });

  it("maps a known repository state failure to a safe action result", async () => {
    privacyRepository.requestCastingDeletion.mockImplementation(() => {
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
    privacyRepository.requestCastingDeletion.mockImplementation(() => {
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
