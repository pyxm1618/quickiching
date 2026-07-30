import type {
  CreateLoginIntentInput,
  LoginIntentRepository,
} from "../login-intent-repository";
import type {
  ConsumeLoginIntentAndRevealInput,
  FingerprintCandidate,
  RevealOutcome,
  RevealOwnedCastingInput,
  RevealRepository,
} from "../reveal-repository";
import type { CastingSession, LoginIntent, QuestionLock } from "../models";
import { snapshot } from "./snapshot";
import { memoryId, repositoryError, type MemoryStore } from "./store";

const HOUR_MS = 60 * 60 * 1000;

export class MemoryRevealRepository implements LoginIntentRepository, RevealRepository {
  constructor(private readonly store: MemoryStore) {}

  createLoginIntent(input: CreateLoginIntentInput): LoginIntent {
    return this.store.withLock(() => {
      const intent: LoginIntent = {
        id: memoryId("lint"),
        castingSessionId: input.castingSessionId,
        anonymousSessionHash: input.anonymousSessionHash,
        nonceHash: input.nonceHash,
        nonceKeyVersion: input.nonceKeyVersion,
        allowedCallbackPath: input.allowedCallbackPath,
        expiresAt: new Date(input.expiresAt),
        consumedAt: null,
        createdAt: new Date(input.createdAt),
      };
      this.store.loginIntents.set(intent.id, intent);
      return snapshot(intent);
    });
  }

  getLoginIntent(intentId: string): LoginIntent | undefined {
    const intent = this.store.loginIntents.get(intentId);
    return intent ? snapshot(intent) : undefined;
  }

  consumeLoginIntentAndReveal(input: ConsumeLoginIntentAndRevealInput): RevealOutcome {
    return this.store.withLock(() => {
      const intent = this.store.loginIntents.get(input.intentId);
      if (!intent) throw repositoryError("LOGIN_INTENT_NOT_FOUND");
      if (intent.consumedAt) throw repositoryError("LOGIN_INTENT_CONSUMED");
      if (intent.expiresAt.getTime() <= input.now.getTime()) throw repositoryError("LOGIN_INTENT_EXPIRED");
      if (intent.nonceKeyVersion !== input.nonceKeyVersion || intent.nonceHash !== input.nonceHash) {
        throw repositoryError("LOGIN_INTENT_INVALID");
      }
      if (intent.allowedCallbackPath !== input.callbackPath) {
        throw repositoryError("LOGIN_INTENT_CALLBACK_INVALID");
      }

      const session = this.store.castingSessions.get(intent.castingSessionId);
      if (!session || session.anonymousSessionHash !== intent.anonymousSessionHash) {
        throw repositoryError("CASTING_NOT_FOUND");
      }
      this.assertRevealable(session, input.now);

      const existing = this.findActiveLock(
        input.authenticatedUserId,
        input.fingerprintCandidates,
        input.now,
      );
      intent.consumedAt = new Date(input.now);

      if (existing && existing.winningCastingId !== session.id) {
        session.lifecycle = "discarded_duplicate";
        session.duplicateOfCastingId = existing.winningCastingId;
        session.updatedAt = new Date(input.now);
        return {
          revealed: false,
          duplicate: true,
          castingId: existing.winningCastingId,
        };
      }

      this.writeQuestionLock(input.authenticatedUserId, input.writeFingerprint, session.id, input.now);
      this.bindAndReveal(session, input.authenticatedUserId, input.writeFingerprint, input.now);
      return { revealed: true, duplicate: false, castingId: session.id };
    });
  }

  revealOwnedCasting(input: RevealOwnedCastingInput): RevealOutcome {
    return this.store.withLock(() => {
      const session = this.store.castingSessions.get(input.castingId);
      if (!session || session.userId !== input.authenticatedUserId) {
        throw repositoryError("CASTING_NOT_FOUND");
      }
      if (session.lifecycle === "revealed") {
        return { revealed: true, duplicate: false, castingId: session.id };
      }
      this.assertRevealable(session, input.now);

      const existing = this.findActiveLock(
        input.authenticatedUserId,
        input.fingerprintCandidates,
        input.now,
      );
      if (existing && existing.winningCastingId !== session.id) {
        session.lifecycle = "discarded_duplicate";
        session.duplicateOfCastingId = existing.winningCastingId;
        session.updatedAt = new Date(input.now);
        return {
          revealed: false,
          duplicate: true,
          castingId: existing.winningCastingId,
        };
      }

      this.writeQuestionLock(input.authenticatedUserId, input.writeFingerprint, session.id, input.now);
      this.bindAndReveal(session, input.authenticatedUserId, input.writeFingerprint, input.now);
      return { revealed: true, duplicate: false, castingId: session.id };
    });
  }

  private assertRevealable(session: CastingSession, now: Date): void {
    if (session.lifecycle !== "awaiting_reveal") throw repositoryError("CASTING_NOT_REVEALABLE");
    if (session.revealExpiresAt && session.revealExpiresAt.getTime() <= now.getTime()) {
      session.lifecycle = "expired";
      session.updatedAt = new Date(now);
      throw repositoryError("CASTING_NOT_REVEALABLE");
    }
  }

  private findActiveLock(
    userId: string,
    candidates: FingerprintCandidate[],
    now: Date,
  ): QuestionLock | undefined {
    for (const candidate of candidates) {
      const lock = this.store.questionLocks.get(this.lockKey(userId, candidate));
      if (lock && lock.lockedUntil.getTime() > now.getTime()) return lock;
    }
    return undefined;
  }

  private writeQuestionLock(
    userId: string,
    fingerprint: FingerprintCandidate,
    castingId: string,
    now: Date,
  ): void {
    const key = this.lockKey(userId, fingerprint);
    const existing = this.store.questionLocks.get(key);
    if (existing) {
      existing.winningCastingId = castingId;
      existing.lockedUntil = new Date(now.getTime() + 72 * HOUR_MS);
      existing.updatedAt = new Date(now);
      return;
    }
    this.store.questionLocks.set(key, {
      userId,
      questionFingerprint: fingerprint.fingerprint,
      fingerprintKeyVersion: fingerprint.keyVersion,
      winningCastingId: castingId,
      lockedUntil: new Date(now.getTime() + 72 * HOUR_MS),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
  }

  private bindAndReveal(
    session: CastingSession,
    userId: string,
    fingerprint: FingerprintCandidate,
    now: Date,
  ): void {
    session.userId = userId;
    session.anonymousSessionHash = null;
    session.questionFingerprint = fingerprint.fingerprint;
    session.fingerprintKeyVersion = fingerprint.keyVersion;
    session.revealedAt = new Date(now);
    session.lifecycle = "revealed";
    session.updatedAt = new Date(now);
  }

  private lockKey(userId: string, fingerprint: FingerprintCandidate): string {
    return `${userId}|${fingerprint.keyVersion}|${fingerprint.fingerprint}`;
  }
}
