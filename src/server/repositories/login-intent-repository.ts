import type { LoginIntent } from "./models";

export type CreateLoginIntentInput = {
  castingSessionId: string;
  anonymousSessionHash: string;
  nonceHash: string;
  nonceKeyVersion: string;
  expectedEmailHash?: string | null;
  expectedEmailKeyVersion?: string | null;
  allowedCallbackPath: string;
  expiresAt: Date;
  createdAt: Date;
};

export interface LoginIntentRepository {
  createLoginIntent(input: CreateLoginIntentInput): LoginIntent;
  getLoginIntent(intentId: string): LoginIntent | undefined;
  findLoginIntentByNonceHash(nonceHash: string, nonceKeyVersion: string): LoginIntent | undefined;
}
