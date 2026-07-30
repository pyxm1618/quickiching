import { DomainError } from "@/server/errors/domain-error";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { PrivacyRepository } from "@/server/repositories/privacy-repository";

export class PrivacyService {
  constructor(private readonly dependencies: {
    privacyRepository: PrivacyRepository;
    castingRepository: CastingRepository;
    clock: { now(): Date };
  }) {}

  requestDeletion(castingId: string, userId: string) {
    const session = this.dependencies.castingRepository.getCastingSession(castingId);
    if (!session || session.userId !== userId) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    }
    if (session.lifecycle !== "revealed") {
      throw new DomainError("CASTING_NOT_DELETABLE", "This casting cannot be deleted in its current state.", false);
    }
    return this.dependencies.privacyRepository.requestCastingDeletion(
      castingId,
      this.dependencies.clock.now(),
    );
  }

  restore(castingId: string, userId: string) {
    const recoverable = this.dependencies.privacyRepository
      .listRecoverableDeletedCasts(userId, this.dependencies.clock.now())
      .some((session) => session.id === castingId);
    if (!recoverable) {
      throw new DomainError(
        "DELETION_RECOVERY_CLOSED",
        "This casting can no longer be restored.",
        false,
      );
    }
    return this.dependencies.privacyRepository.restoreCasting(
      castingId,
      userId,
      this.dependencies.clock.now(),
    );
  }

  listRecoverable(userId: string) {
    return this.dependencies.privacyRepository.listRecoverableDeletedCasts(
      userId,
      this.dependencies.clock.now(),
    );
  }

  purgeDue(): number {
    return this.dependencies.privacyRepository.purgeDeletedCasts(this.dependencies.clock.now());
  }

  requestAccountDeletion(userId: string) {
    return this.dependencies.privacyRepository.requestAccountDeletion(
      userId,
      this.dependencies.clock.now(),
    );
  }

  getAccountDeletion(userId: string) {
    return this.dependencies.privacyRepository.getAccountDeletion(userId);
  }

  restoreAccount(userId: string) {
    try {
      return this.dependencies.privacyRepository.restoreAccount(
        userId,
        this.dependencies.clock.now(),
      );
    } catch {
      throw new DomainError(
        "ACCOUNT_DELETION_RECOVERY_CLOSED",
        "This account can no longer be restored.",
        false,
      );
    }
  }

  purgeDueAccounts(): number {
    return this.dependencies.privacyRepository.purgeDeletedAccounts(this.dependencies.clock.now());
  }
}
