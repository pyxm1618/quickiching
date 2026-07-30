export type FingerprintCandidate = {
  fingerprint: string;
  keyVersion: string;
};

export type RevealOutcome = {
  revealed: boolean;
  duplicate: boolean;
  castingId: string;
};

export type ConsumeLoginIntentAndRevealInput = {
  intentId: string;
  nonceHash: string;
  nonceKeyVersion: string;
  authenticatedUserId: string;
  callbackPath: string;
  fingerprintCandidates: FingerprintCandidate[];
  writeFingerprint: FingerprintCandidate;
  now: Date;
};

export type RevealOwnedCastingInput = {
  castingId: string;
  authenticatedUserId: string;
  fingerprintCandidates: FingerprintCandidate[];
  writeFingerprint: FingerprintCandidate;
  now: Date;
};

export interface RevealRepository {
  consumeLoginIntentAndReveal(input: ConsumeLoginIntentAndRevealInput): RevealOutcome;
  revealOwnedCasting(input: RevealOwnedCastingInput): RevealOutcome;
}
