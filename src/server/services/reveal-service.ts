import { fingerprintQuestion, normalizeComposite } from "@/domain/questions/normalize";
import {
  resolveVersionedKey,
  resolveWriteKey,
  type VersionedKeySet,
} from "@/server/config";
import { DomainError } from "@/server/errors/domain-error";
import {
  assertAllowedCallbackPath,
  createLoginHandoffState,
  emailMatches,
  hashLoginExpectedEmail,
  hashLoginIntentNonce,
  nonceMatches,
  verifyLoginHandoffState,
} from "@/server/auth/login-intent";
import type { CastingRepository } from "@/server/repositories/casting-repository";
import type { LoginIntentRepository } from "@/server/repositories/login-intent-repository";
import type { LoginIntent } from "@/server/repositories/models";
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

type PreparedIntent = {
  castingId: string;
  anonymousSessionHash: string;
  callbackPath: string;
  now: Date;
  expiresAt: Date;
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
    const prepared = this.prepareIntent(input);
    const nonce = this.dependencies.tokenSource.randomToken();
    const nonceKey = resolveWriteKey(this.dependencies.sessionSigningKeys);
    const intent = this.dependencies.loginIntentRepository.createLoginIntent({
      castingSessionId: prepared.castingId,
      anonymousSessionHash: prepared.anonymousSessionHash,
      nonceHash: hashLoginIntentNonce(nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      allowedCallbackPath: prepared.callbackPath,
      expiresAt: prepared.expiresAt,
      createdAt: prepared.now,
    });
    return {
      intentId: intent.id,
      nonce,
      allowedCallbackPath: intent.allowedCallbackPath,
      expiresAt: intent.expiresAt,
    };
  }

  startLoginHandoff(input: {
    castingId: string;
    anonymousSessionHash: string;
    expectedEmail: string;
    allowedCallbackPath: string;
  }): {
    handoffState: string;
    allowedCallbackPath: string;
    expiresAt: Date;
  } {
    const prepared = this.prepareIntent(input);
    const token = this.dependencies.tokenSource.randomToken();
    const key = resolveWriteKey(this.dependencies.sessionSigningKeys);
    const intent = this.dependencies.loginIntentRepository.createLoginIntent({
      castingSessionId: prepared.castingId,
      anonymousSessionHash: prepared.anonymousSessionHash,
      nonceHash: hashLoginIntentNonce(token, key),
      nonceKeyVersion: key.version,
      expectedEmailHash: hashLoginExpectedEmail(input.expectedEmail, key),
      expectedEmailKeyVersion: key.version,
      allowedCallbackPath: prepared.callbackPath,
      expiresAt: prepared.expiresAt,
      createdAt: prepared.now,
    });
    return {
      handoffState: createLoginHandoffState(token, key),
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
    return this.consumeResolvedIntent(intent, input.nonce, input.authenticatedUserId, callbackPath);
  }

  consumeLoginHandoffAndReveal(input: {
    handoffState: string;
    authenticatedUserId: string;
    authenticatedEmail: string;
  }): RevealOutcome {
    const verified = verifyLoginHandoffState(input.handoffState, this.dependencies.sessionSigningKeys);
    if (!verified) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }
    const key = resolveVersionedKey(this.dependencies.sessionSigningKeys, verified.keyVersion);
    const nonceHash = hashLoginIntentNonce(verified.token, key);
    const intent = this.dependencies.loginIntentRepository.findLoginIntentByNonceHash(
      nonceHash,
      verified.keyVersion,
    );
    if (!intent) {
      throw new DomainError("LOGIN_INTENT_INVALID", "This sign-in link is invalid.", false);
    }
    if (
      !intent.expectedEmailHash
      || !intent.expectedEmailKeyVersion
      || !emailMatches(
        intent.expectedEmailHash,
        intent.expectedEmailKeyVersion,
        input.authenticatedEmail,
        this.dependencies.sessionSigningKeys,
      )
    ) {
      throw new DomainError(
        "LOGIN_INTENT_EMAIL_MISMATCH",
        "This sign-in identity does not match the requested email.",
        false,
      );
    }
    return this.consumeResolvedIntent(
      intent,
      verified.token,
      input.authenticatedUserId,
      intent.allowedCallbackPath,
    );
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

  private prepareIntent(input: {
    castingId: string;
    anonymousSessionHash: string;
    allowedCallbackPath: string;
  }): PreparedIntent {
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
    const expiresAt = new Date(Math.min(
      now.getTime() + LOGIN_INTENT_TTL_MS,
      session.revealExpiresAt?.getTime() ?? Number.POSITIVE_INFINITY,
    ));
    return {
      castingId: session.id,
      anonymousSessionHash: input.anonymousSessionHash,
      callbackPath,
      now,
      expiresAt,
    };
  }

  private consumeResolvedIntent(
    intent: LoginIntent,
    nonce: string,
    authenticatedUserId: string,
    callbackPath: string,
  ): RevealOutcome {
    const nonceKey = resolveVersionedKey(
      this.dependencies.sessionSigningKeys,
      intent.nonceKeyVersion,
    );
    const fingerprints = this.fingerprintsForCasting(intent.castingSessionId);
    return this.dependencies.revealRepository.consumeLoginIntentAndReveal({
      intentId: intent.id,
      nonceHash: hashLoginIntentNonce(nonce, nonceKey),
      nonceKeyVersion: nonceKey.version,
      authenticatedUserId,
      callbackPath: assertAllowedCallbackPath(callbackPath),
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
