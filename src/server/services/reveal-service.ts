import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import {
  resolveVersionedKey,
  resolveWriteKey,
  type VersionedKeySet,
} from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import {
  assertAllowedCallbackPath,
  hashLoginIntentNonce,
  nonceMatches,
} from "@/server/auth/login-intent";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { LoginIntentRepository } from "@/server/repositories/login-intent-repository";
import type {
  FingerprintCandidate,
  RevealOutcome,
  RevealRepository,
} from "@/server/repositories/reveal-repository";

const LOGIN_INTENT_TTL_MS = 10 * 60 * 1000;

export type RevealServiceDependencies = {
  castingRepository: CastingRepository;
  loginIntentRepository: LoginIntentRepository;
  revealRepository: RevealRepository;
  clock: { now(): Date };
  tokenSource: { randomToken(): string };
  sessionSigningKeys: VersionedKeySet;
  questionFingerprintKeys: VersionedKeySet;
};

export class RevealService {
  constructor(private readonly dependencies: RevealServiceDependencies) {}

  startLoginIntent(input: {
    castingId: string;
    anonymousSessionHash: string;
    allowedCallbackPath: string;
  }): {
    intentId: string;
    nonce: string;
    allowedCallbackPath: string;
    expiresAt: Date;
  } {
    const callbackPath = assertAllowedCallbackPath(input.allowedCallbackPath);
    const session = this.dependencies.castingRepository.getCastingSession(input.castingId);
    if (
      !session
      || session.anonymousSessionHash !== input.anonymousSessionHash
      || session.userId !== null
    ) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    }
    const now = this.dependencies.clock.now();
    if (session.lifecycle !== "awaiting_reveal") {
      throw new DomainError("CASTING_NOT_REVEALABLE", "This casting is not ready to be revealed", false);
    }
    if (session.revealExpiresAt && session.revealExpiresAt.getTime() <= now.getTime()) {
      this.dependencies.castingRepository.transitionCasting(session.id, "expired");
      throw new DomainError("CASTING_EXPIRED", "This casting is no longer available to reveal", false);
    }

    const nonce = this.dependencies.tokenSource.randomToken();
    const nonceKey = resolveWriteKey(this.dependencies.sessionSigningKeys);
    const expiresAt = new Date(Math.min(
      now.getTime() + LOGIN_INTENT_TTL_MS,
      session.revealExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
    ));
    const intent = this.dependencies.loginIntentRepository.createLoginIntent({
      castingSessionId: session.id,
      anonymousSessionHash: input.anonymousSessionHash,
      nonceHash: hashLoginIntentNonce(nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      allowedCallbackPath: callbackPath,
      expiresAt,
      createdAt: now,
    });
    return {
      intentId: intent.id,
      nonce,
      allowedCallbackPath: intent.allowedCallbackPath,
      expiresAt: intent.expiresAt,
    };
  }

  consumeLoginIntentAndReveal(input: {
    intentId: string;
    nonce: string;
    authenticatedUserId: string;
    callbackPath: string;
  }): RevealOutcome {
    const callbackPath = assertAllowedCallbackPath(input.callbackPath);
    const intent = this.dependencies.loginIntentRepository.getLoginIntent(input.intentId);
    if (!intent) throw new DomainError("LOGIN_INTENT_NOT_FOUND", "This sign-in link is invalid.", false);
    if (!nonceMatches(
      intent.nonceHash,
      intent.nonceKeyVersion,
      input.nonce,
      this.dependencies.sessionSigningKeys,
    )) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }
    const nonceKey = resolveVersionedKey(
      this.dependencies.sessionSigningKeys,
      intent.nonceKeyVersion,
    );
    const fingerprints = this.fingerprintsForCasting(intent.castingSessionId);
    return this.dependencies.revealRepository.consumeLoginIntentAndReveal({
      intentId: intent.id,
      nonceHash: hashLoginIntentNonce(input.nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      authenticatedUserId: input.authenticatedUserId,
      callbackPath,
      fingerprintCandidates: fingerprints.candidates,
      writeFingerprint: fingerprints.write,
      now: this.dependencies.clock.now(),
    });
  }

  revealOwnedCasting(input: {
    castingId: string;
    authenticatedUserId: string;
  }): RevealOutcome {
    const session = this.dependencies.castingRepository.getCastingSession(input.castingId);
    if (!session || session.userId !== input.authenticatedUserId) {
      throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    }
    const fingerprints = this.fingerprintsForCasting(input.castingId);
    return this.dependencies.revealRepository.revealOwnedCasting({
      castingId: input.castingId,
      authenticatedUserId: input.authenticatedUserId,
      fingerprintCandidates: fingerprints.candidates,
      writeFingerprint: fingerprints.write,
      now: this.dependencies.clock.now(),
    });
  }

  private fingerprintsForCasting(castingId: string): {
    candidates: FingerprintCandidate[];
    write: FingerprintCandidate;
  } {
    const session = this.dependencies.castingRepository.getCastingSession(castingId);
    if (!session) throw new DomainError("CASTING_NOT_FOUND", "Casting session not found", false);
    const context = this.dependencies.castingRepository.getLatestQuestionContext(castingId);
    const composite = normalizeComposite(session.scene, session.interpretationGoal, context);
    const candidates = this.dependencies.questionFingerprintKeys.read.map((key) => ({
      keyVersion: key.version,
      fingerprint: fingerprintQuestion(composite, key.value, key.version),
    }));
    const write = candidates.find(
      (candidate) => candidate.keyVersion === this.dependencies.questionFingerprintKeys.writeVersion,
    );
    if (!write) throw new Error("QUESTION_FINGERPRINT_WRITE_KEY_MISSING");
    return { candidates, write };
  }
}
